import { callOpenRouter, OpenRouterError, stripReasoning } from "./openrouter";
import {
  ANALYSIS_SYSTEM,
  DETAILED_READING_SYSTEM,
  QUICK_INSIGHTS_SYSTEM,
} from "./prompts";
import { parseAnalysis } from "./parse";
import { updateReading, addMessage, getReading } from "./readings";
import type { AnalysisJson } from "./types";

export type GenerateResult =
  | { ok: true; handElement: string | null }
  | { ok: false; kind: "not_a_palm" | "rate_limited" | "model_error"; message: string };

export type DetailedResult =
  | { ok: true; detailedText: string }
  | { ok: false; kind: "rate_limited" | "model_error" | "not_ready"; message: string };

// Vercel Hobby hard-kills a function at 60s with a platform crash page (not
// JSON our client can read) regardless of `maxDuration` in the route — so
// every OpenRouter call in this file budgets to a deadline well under that,
// leaving headroom for DB round trips, cold start, and response
// serialization. Blowing past this must always resolve to our own friendly
// error, never a silent platform timeout.
const FUNCTION_TIME_BUDGET_MS = 48_000;
const MIN_USEFUL_CALL_MS = 4_000; // below this, don't even attempt a call

function friendlyModelError(err: unknown): { kind: "rate_limited" | "model_error"; message: string } {
  if (err instanceof OpenRouterError && err.isRateLimit) {
    return {
      kind: "rate_limited",
      message:
        "The reader is fielding a lot of hands right now. Give it a moment and try again.",
    };
  }
  return {
    kind: "model_error",
    message: "That didn't come through. This usually clears up on a second try.",
  };
}

/**
 * Runs the vision model once on a palm image, parses it into structured
 * analysis JSON, then a second (text-only, no image) call turns that JSON
 * into the Quick Insights prose the user sees first. Persists
 * analysis_json + reading_text (Quick Insights) + the first assistant chat
 * message, and sets status to 'complete' or 'failed'. Never throws for
 * expected failure modes — returns a tagged result instead.
 */
export async function generateAndPersistReading(
  readingId: string,
  imageDataUrl: string,
): Promise<GenerateResult> {
  // Shared across both calls below — callOpenRouter's default timeout is a
  // fresh window per call, so without this the analysis and Quick Insights
  // calls could each run close to their own full budget and together blow
  // well past Vercel's hard function ceiling (see FUNCTION_TIME_BUDGET_MS).
  const deadline = Date.now() + FUNCTION_TIME_BUDGET_MS;

  let rawAnalysis: string;
  try {
    rawAnalysis = await callOpenRouter({
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Here is my palm. Please analyze it." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.7,
      maxTokens: 1400,
      timeoutMs: deadline - Date.now(),
    });
  } catch (err) {
    await updateReading(readingId, { status: "failed" }).catch(() => {});
    return { ok: false, ...friendlyModelError(err) };
  }

  const parsed = parseAnalysis(rawAnalysis);

  if (!parsed.isPalm || !parsed.analysis) {
    const message =
      parsed.clarification ??
      "I couldn't quite make out a palm there. Try again with your hand open, palm to the camera, in even light.";
    // Stash the reason in reading_text so the reading page can show it
    // (the schema has no dedicated error column).
    await updateReading(readingId, {
      status: "failed",
      reading_text: `NOT_A_PALM: ${message}`,
    }).catch(() => {});
    return { ok: false, kind: "not_a_palm", message };
  }

  const analysis = parsed.analysis;

  // Whatever's left of the shared budget after the (usually slower, always
  // larger) analysis call above. If there's not enough left to be worth a
  // network round trip, skip straight to the fallback rather than risk
  // getting killed mid-request with no response at all.
  const remaining = deadline - Date.now();
  let quickInsights: string;
  if (remaining < MIN_USEFUL_CALL_MS) {
    quickInsights = fallbackQuickInsights(analysis);
  } else {
    try {
      const raw = await callOpenRouter({
        messages: [
          { role: "system", content: QUICK_INSIGHTS_SYSTEM },
          { role: "user", content: JSON.stringify(analysis) },
        ],
        temperature: 0.85,
        maxTokens: 700,
        timeoutMs: remaining,
      });
      quickInsights = stripReasoning(raw) || raw.trim();
    } catch (err) {
      // The (expensive) image analysis already succeeded — don't discard
      // it. Fall back to a plain-language stitch of the analysis so the
      // reading still completes; the user can always ask chat for more.
      quickInsights = fallbackQuickInsights(analysis);
      void err;
    }
  }

  await updateReading(readingId, {
    status: "complete",
    reading_text: quickInsights.trim(),
    hand_element: analysis.hand_element,
    analysis_json: analysis,
  });
  await addMessage(readingId, "assistant", quickInsights.trim());

  return { ok: true, handElement: analysis.hand_element };
}

function fallbackQuickInsights(analysis: AnalysisJson): string {
  const { lines } = analysis;
  return [
    analysis.hand_element
      ? `Your hand reads as ${analysis.hand_element} in shape — steady ground for the four lines that follow.`
      : `Your hand's shape was hard to place with confidence, but the four lines still had plenty to say.`,
    `**Life Line.** ${lines.life.takeaway}`,
    `**Heart Line.** ${lines.heart.takeaway}`,
    `**Head Line.** ${lines.head.takeaway}`,
    `**Fate Line.** ${lines.fate.takeaway}`,
    `There's more waiting whenever you're ready for the full reading.`,
  ].join("\n\n");
}

/**
 * Generates the Detailed Reading from the already-stored analysis_json —
 * no image re-sent. Idempotent: if detailed_text already exists, returns it
 * without calling the model again.
 */
export async function generateDetailedReading(readingId: string): Promise<DetailedResult> {
  const reading = await getReading(readingId);
  if (!reading || reading.status !== "complete" || !reading.analysis_json) {
    return {
      ok: false,
      kind: "not_ready",
      message: "This reading isn't ready for the full version yet.",
    };
  }
  if (reading.detailed_text) {
    return { ok: true, detailedText: reading.detailed_text };
  }

  let raw: string;
  try {
    raw = await callOpenRouter({
      messages: [
        { role: "system", content: DETAILED_READING_SYSTEM },
        { role: "user", content: JSON.stringify(reading.analysis_json) },
      ],
      temperature: 0.85,
      maxTokens: 2200,
      timeoutMs: FUNCTION_TIME_BUDGET_MS,
    });
  } catch (err) {
    return { ok: false, ...friendlyModelError(err) };
  }

  // Store whatever the model returned (JSON is preferred for themed
  // rendering; parseDetailedReading() falls back gracefully on the render
  // side if it isn't valid JSON) — never silently drop a real reply.
  const cleaned = stripReasoning(raw) || raw.trim();
  const detailedText = cleaned;
  await updateReading(readingId, { detailed_text: detailedText });
  return { ok: true, detailedText };
}
