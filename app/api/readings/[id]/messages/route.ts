import { NextResponse } from "next/server";
import { getReading, getMessages, addMessage, isUuid } from "@/lib/readings";
import { buildChatSystemPrompt } from "@/lib/prompts";
import { parseDetailedReading } from "@/lib/parse";
import {
  callOpenRouter,
  stripReasoning,
  OpenRouterError,
  type ChatMessage,
} from "@/lib/openrouter";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_QUESTION_LEN = 1000;
const MAX_HISTORY_TURNS = 12; // trailing messages passed back as context

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/readings/[id]/messages">,
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const limit = await checkRateLimit("chat_message", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json(errBody, init);
  }

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content =
    typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "Ask a question first." },
      { status: 400 },
    );
  }
  if (content.length > MAX_QUESTION_LEN) {
    return NextResponse.json(
      { error: "That question is a little long — try trimming it down." },
      { status: 400 },
    );
  }

  const reading = await getReading(id);
  if (!reading) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (reading.status !== "complete") {
    return NextResponse.json(
      { error: "This reading isn't ready for questions yet." },
      { status: 409 },
    );
  }

  const priorMessages = await getMessages(id);
  // The first assistant message is the full reading — it's already in the
  // system prompt, so skip it here and keep only the back-and-forth.
  const history = priorMessages.slice(1).slice(-MAX_HISTORY_TURNS);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildChatSystemPrompt({
        quickInsights: reading.reading_text,
        handElement: reading.hand_element,
        analysis: reading.analysis_json,
        detailedSections: reading.detailed_text
          ? parseDetailedReading(reading.detailed_text)
          : null,
      }),
    },
    ...history.map<ChatMessage>((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content },
  ];

  let answer: string;
  try {
    const raw = await callOpenRouter({
      messages,
      temperature: 0.8,
      maxTokens: 900,
    });
    answer = stripReasoning(raw) || raw.trim();
  } catch (err) {
    const isRate = err instanceof OpenRouterError && err.isRateLimit;
    return NextResponse.json(
      {
        error: isRate
          ? "The reader is busy for a moment. Try that question again shortly."
          : "The reader lost the thread there. Please ask again.",
        kind: isRate ? "rate_limited" : "model_error",
      },
      { status: isRate ? 429 : 502 },
    );
  }

  // Persist the pair only once we have a real answer — keeps the transcript
  // free of dangling questions.
  const userMessage = await addMessage(id, "user", content);
  const assistantMessage = await addMessage(id, "assistant", answer);
  return NextResponse.json(
    { userMessage, message: assistantMessage },
    { headers: { "Cache-Control": "no-store" } },
  );
}
