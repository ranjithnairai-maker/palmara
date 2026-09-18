const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_MODEL = "inclusionai/ling-3.0-flash-vl:free";

export function getModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export class OpenRouterError extends Error {
  status: number;
  isRateLimit: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.isRateLimit = status === 429 || looksLikeCapacityError(message);
  }
}

/**
 * OpenRouter/upstream providers don't always signal capacity limits with a
 * clean HTTP 429 — a shared free model can also come back as a 200 or 502
 * with an error payload like "ResourceExhausted: Worker local total request
 * limit reached (16/16)". Treat those the same as a rate limit so the UI
 * shows "try again shortly" instead of a generic failure.
 */
function looksLikeCapacityError(text: string): boolean {
  return /resourceexhausted|resource_exhausted|rate.?limit|too many requests|request limit|quota exceeded|overloaded|worker.*limit reached/i.test(
    text,
  );
}

// OpenAI-compatible message content
type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
export type MessageContent = string | Array<TextPart | ImagePart>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

interface CallOptions {
  messages: ChatMessage[];
  /** Milliseconds before the request is aborted. Default 55s. */
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Calls OpenRouter's Chat Completions endpoint and returns the assistant's
 * text. Server-side only — reads OPENROUTER_API_KEY from the environment.
 * Retries once on a transient capacity error (a shared free model's worker
 * pool is often unstuck within a couple seconds) as long as time remains
 * within the overall timeout budget.
 */
export async function callOpenRouter(opts: CallOptions): Promise<string> {
  const deadline = Date.now() + (opts.timeoutMs ?? 55_000);
  try {
    return await callOpenRouterOnce(opts, deadline);
  } catch (err) {
    const remaining = deadline - Date.now();
    if (err instanceof OpenRouterError && err.isRateLimit && remaining > 8_000) {
      await new Promise((r) => setTimeout(r, 2_500));
      return callOpenRouterOnce(opts, deadline);
    }
    throw err;
  }
}

async function callOpenRouterOnce(
  { messages, temperature = 0.8, maxTokens = 1600 }: CallOptions,
  deadline: number,
): Promise<string> {
  const timeoutMs = Math.max(1000, deadline - Date.now());
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not set", 500);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Root-caused in production + confirmed locally: `fetch()` resolving only
  // means the response HEADERS arrived — reading the body (`res.json()`) is
  // a separate async step that can itself stall indefinitely on a slow or
  // stuck stream, and was previously left completely unprotected once the
  // initial fetch "won". The whole fetch-then-parse sequence is raced here
  // as one unit against an independent timer (not just AbortController,
  // which wasn't reliably rejecting a stalled connection either) so nothing
  // downstream of the initial response can silently hang forever.
  async function fetchAndParse(): Promise<string> {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Palmistica",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://palmistica.com",
      },
      body: JSON.stringify({
        model: getModel(),
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body?.error?.message || JSON.stringify(body?.error || body);
      } catch {
        detail = await res.text().catch(() => "");
      }
      console.error(`[openrouter] ${res.status} ${detail || res.statusText}`);
      throw new OpenRouterError(
        `OpenRouter ${res.status}: ${detail || res.statusText}`,
        res.status,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string | null; reasoning?: string | null };
        finish_reason?: string;
      }>;
      error?: { message?: string };
    };
    if (data.error?.message) {
      console.error(`[openrouter] body error: ${data.error.message}`);
      throw new OpenRouterError(`OpenRouter: ${data.error.message}`, 502);
    }
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? choice?.message?.reasoning ?? "";
    if (!content || !content.trim()) {
      console.error(
        `[openrouter] empty content; finish_reason=${choice?.finish_reason}; raw=${JSON.stringify(
          data,
        ).slice(0, 600)}`,
      );
      throw new OpenRouterError("OpenRouter returned an empty response.", 502);
    }
    return content;
  }

  const raceTimeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new OpenRouterError("The reader took too long to respond.", 504)),
      timeoutMs,
    );
  });

  try {
    const content = await Promise.race([fetchAndParse(), raceTimeout]);
    clearTimeout(timer);
    return content;
  } catch (err) {
    clearTimeout(timer);
    // Whether fetchAndParse() or raceTimeout won, make sure the underlying
    // request is actually cut loose rather than left running unobserved.
    controller.abort();
    if (err instanceof OpenRouterError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenRouterError("The reader took too long to respond.", 504);
    }
    throw new OpenRouterError(
      err instanceof Error ? err.message : "Network error calling OpenRouter",
      502,
    );
  }
}

/** Removes <think>...</think> / reasoning scaffolding some models emit. */
export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^\s*(?:reasoning|analysis):[\s\S]*?(?=\n\s*\n)/i, "")
    .trim();
}

// Seen in production: this model doesn't always wrap its reasoning in
// <think> tags or a "reasoning:" field — sometimes it narrates its entire
// drafting process (word counts, redrafts, a "final version" it then
// second-guesses) directly as plain content, with no delimiter stripReasoning()
// can key off. The persona instructs it not to, but that's a mitigation, not
// a guarantee on a free/flaky model, so call sites with no JSON envelope to
// fall back on (Quick Insights, chat) treat this as a failed call rather
// than storing/showing the leaked transcript.
const REASONING_LEAK_MARKERS = /\b(let me|i need to|now let me|final version|word count)\b/gi;
export function looksLikeReasoningLeak(text: string): boolean {
  return (text.match(REASONING_LEAK_MARKERS) ?? []).length >= 2;
}
