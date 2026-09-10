import type { ParsedReading } from "./types";
import { stripReasoning } from "./openrouter";

const VALID_ELEMENTS = ["Earth", "Air", "Fire", "Water"];

function normalizeElement(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hit = VALID_ELEMENTS.find(
    (e) => e.toLowerCase() === value.trim().toLowerCase(),
  );
  return hit ?? null;
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

/**
 * Parses the vision model's reply into a structured reading. Tolerant of
 * reasoning wrappers, code fences, and models that ignore the JSON contract
 * and just return the markdown reading.
 */
export function parseInitialReading(raw: string): ParsedReading {
  const cleaned = stripReasoning(raw).replace(/```json|```/gi, "").trim();

  const jsonStr = extractJsonObject(cleaned);
  if (jsonStr) {
    try {
      const obj = JSON.parse(jsonStr) as Record<string, unknown>;
      const isPalm = obj.is_palm !== false; // default to true unless explicitly false
      const reading =
        typeof obj.reading === "string" ? obj.reading.trim() : "";
      const clarification =
        typeof obj.clarification === "string" && obj.clarification.trim()
          ? obj.clarification.trim()
          : null;

      if (!isPalm) {
        return {
          isPalm: false,
          handElement: null,
          reading: "",
          clarification:
            clarification ??
            "I couldn't quite make out a palm in that photo. Try again with your hand open, palm toward the camera, in even light.",
        };
      }
      if (reading) {
        return {
          isPalm: true,
          handElement: normalizeElement(obj.hand_element),
          reading,
          clarification: null,
        };
      }
    } catch {
      // fall through to raw-markdown handling
    }
  }

  // No usable JSON — treat the whole cleaned reply as the reading markdown.
  const fallback = cleaned.replace(/^\{[\s\S]*$/, "").trim() || cleaned;
  if (!fallback) {
    return {
      isPalm: false,
      handElement: null,
      reading: "",
      clarification:
        "Something got lost between the reader and the page. Please try once more.",
    };
  }

  // Best-effort element sniff from the prose.
  const elementMatch = fallback.match(
    /\b(Earth|Air|Fire|Water)\b(?=[^.]*\b(hand|element|type)\b)/i,
  );
  return {
    isPalm: true,
    handElement: elementMatch ? normalizeElement(elementMatch[1]) : null,
    reading: fallback,
    clarification: null,
  };
}
