const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_MODEL =
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

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
    this.isRateLimit = status === 429;
  }
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
 */
export async function callOpenRouter({
  messages,
  timeoutMs = 55_000,
  temperature = 0.8,
  maxTokens = 1600,
}: CallOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not set", 500);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Palmara",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://palmara.app",
      },
      body: JSON.stringify({
        model: getModel(),
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenRouterError("The reader took too long to respond.", 504);
    }
    throw new OpenRouterError(
      err instanceof Error ? err.message : "Network error calling OpenRouter",
      502,
    );
  }
  clearTimeout(timer);

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

/** Removes <think>...</think> / reasoning scaffolding some models emit. */
export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/^\s*(?:reasoning|analysis):[\s\S]*?(?=\n\s*\n)/i, "")
    .trim();
}
