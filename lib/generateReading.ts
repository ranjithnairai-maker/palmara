import { callOpenRouter, OpenRouterError, stripReasoning } from "./openrouter";
import {
  ANALYSIS_SYSTEM,
  DETAILED_READING_SYSTEM,
  QUICK_INSIGHTS_SYSTEM,
} from "./prompts";
import { parseAnalysis } from "./parse";
import { sanitizeReadingText } from "./sanitize-reading-text";
import { updateReading, addMessage, getReading } from "./readings";
import type { AnalysisJson } from "./types";

export type GenerateResult =
  | { ok: true; handElement: string | null }
  | { ok: false; kind: "not_a_palm" | "rate_limited" | "model_error"; message: string };

// Runs as a next/server after() background task, not raced against an HTTP
// response — see app/api/readings/[id]/detailed/route.ts for why. Budget
// generously against the route's maxDuration=60 rather than a tight client
// timeout, since nothing is waiting synchronously on this anymore.
const DETAILED_BACKGROUND_TIMEOUT_MS = 50_000;

// Vercel Hobby hard-kills a function at 60s with a platform crash page (not
// JSON our client can read) regardless of `maxDuration` in the route — so
// this stays comfortably under that regardless of model. The current model
// (inclusionai/ling-3.0-flash-vl:free) reasons heavily before answering
// (thousands of reasoning tokens even for a short final answer) and its
// vision analysis call alone measured 20-30s in testing, so this needs
// more headroom than a lighter model would; the real safety net is
// openrouter.ts racing the whole fetch-then-parse sequence against this
// budget, so exceeding it always resolves to a clean 'failed' status
// rather than a platform crash either way.
const FUNCTION_TIME_BUDGET_MS = 45_000;
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
      // Generous — this model spends a large share of its output budget on
      // internal reasoning before ever emitting the actual JSON answer;
      // too tight a cap here silently truncates to empty content.
      maxTokens: 4000,
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
        maxTokens: 2500,
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

  // Safety net: prompt instructions alone don't fully stop a small/free
  // model from reaching for em dashes or the odd grammatical slip.
  quickInsights = sanitizeReadingText(quickInsights).trim();

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
 * Runs the Detailed Reading generation in the background, kicked off via
 * next/server's after() from the /detailed route rather than awaited by
 * its HTTP response. This call can legitimately take 20-50+ seconds on the
 * free model (confirmed in production — it isn't just slow to fail, it can
 * genuinely hang with no response for that long), which is too long to
 * hold a single request open for reliably under Vercel's hard 60s function
 * ceiling. So instead: this always resolves (never throws), writing the
 * outcome straight to the reading row — detailed_text on success,
 * detailed_status set to a friendly message on failure — and the client
 * polls GET /api/readings/[id] to see it land, exactly like the main
 * reading's /generate flow already does for the same reason.
 */
export async function runDetailedReadingGeneration(readingId: string): Promise<void> {
  const reading = await getReading(readingId);
  if (!reading || reading.status !== "complete" || !reading.analysis_json || reading.detailed_text) {
    return; // route already validated this before scheduling — nothing to do
  }

  let raw: string;
  try {
    raw = await callOpenRouter({
      messages: [
        { role: "system", content: DETAILED_READING_SYSTEM },
        { role: "user", content: JSON.stringify(reading.analysis_json) },
      ],
      temperature: 0.85,
      // Generous for the same reasoning-overhead reason as the analysis
      // call above, and this is the largest completion in the app (~700
      // words across 7 fields) — this runs backgrounded (see the function
      // doc above), so a longer cap costs time, not a blocked client.
      maxTokens: 6000,
      timeoutMs: DETAILED_BACKGROUND_TIMEOUT_MS,
    });
  } catch (err) {
    const { message } = friendlyModelError(err);
    await updateReading(readingId, { detailed_status: message }).catch((updateErr) => {
      console.error(
        `[generateReading] failed to persist detailed_status failure: ${updateErr instanceof Error ? updateErr.message : updateErr}`,
      );
    });
    return;
  }

  // Store whatever the model returned (JSON is preferred for themed
  // rendering; parseDetailedReading() falls back gracefully on the render
  // side if it isn't valid JSON) — never silently drop a real reply.
  // Sanitized here too (on top of parseDetailedReading()'s own per-field
  // pass in lib/parse.ts) so the raw-markdown fallback path is also clean
  // when the model's reply isn't valid JSON. An em dash never appears in
  // bare JSON syntax outside a string value, so this is safe to run on the
  // whole blob before it's even parsed.
  const detailedText = sanitizeReadingText(stripReasoning(raw) || raw.trim());
  await updateReading(readingId, { detailed_text: detailedText, detailed_status: null }).catch(() => {});
}
