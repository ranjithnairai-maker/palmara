import { callOpenRouter, OpenRouterError } from "./openrouter";
import { INITIAL_READING_SYSTEM } from "./prompts";
import { parseInitialReading } from "./parse";
import { updateReading, addMessage } from "./readings";

export type GenerateResult =
  | { ok: true; handElement: string | null }
  | { ok: false; kind: "not_a_palm" | "rate_limited" | "model_error"; message: string };

/**
 * Runs the vision model on a palm image, parses the structured reply, and
 * persists the reading + first assistant message. Sets reading status to
 * 'complete' on success or 'failed' on error. Never throws for expected
 * failure modes — returns a tagged result instead.
 */
export async function generateAndPersistReading(
  readingId: string,
  imageDataUrl: string,
): Promise<GenerateResult> {
  let raw: string;
  try {
    raw = await callOpenRouter({
      messages: [
        { role: "system", content: INITIAL_READING_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Here is my palm. Please read it.",
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.85,
      maxTokens: 1700,
    });
  } catch (err) {
    await updateReading(readingId, { status: "failed" }).catch(() => {});
    if (err instanceof OpenRouterError && err.isRateLimit) {
      return {
        ok: false,
        kind: "rate_limited",
        message:
          "The reader is fielding a lot of hands right now. Give it a moment and try again.",
      };
    }
    return {
      ok: false,
      kind: "model_error",
      message:
        "The reading didn't come through. This usually clears up on a second try.",
    };
  }

  const parsed = parseInitialReading(raw);

  if (!parsed.isPalm) {
    const message =
      parsed.clarification ??
      "I couldn't quite make out a palm there. Try again with your hand open, palm to the camera, in even light.";
    // Stash the reason in reading_text so the reading page can show it
    // (the fixed schema has no dedicated error column).
    await updateReading(readingId, {
      status: "failed",
      reading_text: `NOT_A_PALM: ${message}`,
    }).catch(() => {});
    return { ok: false, kind: "not_a_palm", message };
  }

  await updateReading(readingId, {
    status: "complete",
    reading_text: parsed.reading,
    hand_element: parsed.handElement,
  });
  await addMessage(readingId, "assistant", parsed.reading);

  return { ok: true, handElement: parsed.handElement };
}
