import type { AnalysisJson, DetailedSections, ParsedAnalysis } from "./types";
import { stripReasoning } from "./openrouter";

const VALID_ELEMENTS = ["Earth", "Air", "Fire", "Water"];
const LINE_KEYS = ["life", "heart", "head", "fate"] as const;

function normalizeElement(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hit = VALID_ELEMENTS.find(
    (e) => e.toLowerCase() === value.trim().toLowerCase(),
  );
  return hit ?? null;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

/** Pulls the first balanced-looking JSON object out of a string. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function cleanReply(raw: string): string {
  return stripReasoning(raw).replace(/```json|```/gi, "").trim();
}

/**
 * Parses the vision model's structured analysis reply. Tolerant of
 * reasoning wrappers and code fences; if the JSON is missing or malformed
 * for a "this is a palm" reply, still salvages an analysis with whatever
 * line data parsed, since a partial structured reading beats none.
 */
export function parseAnalysis(raw: string): ParsedAnalysis {
  const cleaned = cleanReply(raw);
  const jsonStr = extractJsonObject(cleaned);

  if (!jsonStr) {
    return {
      isPalm: false,
      analysis: null,
      clarification:
        "Something got lost between the reader and the page. Please try once more.",
    };
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return {
      isPalm: false,
      analysis: null,
      clarification:
        "Something got lost between the reader and the page. Please try once more.",
    };
  }

  const isPalm = obj.is_palm !== false; // default to true unless explicitly false
  if (!isPalm) {
    const clarification = str(
      obj.clarification,
      "I couldn't quite make out a palm in that photo. Try again with your hand open, palm toward the camera, in even light.",
    );
    return { isPalm: false, analysis: null, clarification };
  }

  const linesRaw =
    obj.lines && typeof obj.lines === "object"
      ? (obj.lines as Record<string, unknown>)
      : {};

  const lines = {} as AnalysisJson["lines"];
  for (const key of LINE_KEYS) {
    const entry =
      linesRaw[key] && typeof linesRaw[key] === "object"
        ? (linesRaw[key] as Record<string, unknown>)
        : {};
    lines[key] = {
      traits: str(entry.traits, "hard to make out clearly in this photo"),
      takeaway: str(entry.takeaway, "worth a closer look another time"),
    };
  }

  const analysis: AnalysisJson = {
    hand_element: normalizeElement(obj.hand_element),
    lines,
    mounts: str(obj.mounts),
    headline: str(obj.headline, "A reading, written for one hand only."),
  };

  return { isPalm: true, analysis, clarification: null };
}

/**
 * Parses the Detailed Reading model's JSON reply into themed sections.
 * Tolerant: returns null (not a throw) on anything unparseable so the
 * caller can fall back to rendering the raw text as markdown prose —
 * small/free models don't always follow strict JSON instructions.
 */
export function parseDetailedReading(raw: string): DetailedSections | null {
  const cleaned = cleanReply(raw);
  const jsonStr = extractJsonObject(cleaned);
  if (!jsonStr) return null;

  try {
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    const sections: DetailedSections = {
      handElement: str(obj.hand_element),
      vitality: str(obj.vitality),
      love: str(obj.love),
      mind: str(obj.mind),
      path: str(obj.path),
      mounts: str(obj.mounts),
      closing: str(obj.closing),
    };
    // Require the core narrative fields — a mostly-empty object isn't a
    // usable Detailed Reading, let the caller fall back to raw text.
    if (!sections.vitality || !sections.love || !sections.mind || !sections.path) {
      return null;
    }
    return sections;
  } catch {
    return null;
  }
}
