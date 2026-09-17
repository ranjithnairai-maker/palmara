const DASH_PUNCTUATION = /\s*—\s*|\s+--\s+/g;

// Words that virtually never start a fresh independent clause in this kind
// of prose (conjunctions, relative pronouns, subordinators, prepositions,
// articles) — seeing one of these right after a dash is strong evidence the
// dash was introducing an aside/appositive, not joining two full sentences.
const CONTINUATION_STARTERS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "so", "yet", "not", "no",
  "which", "who", "whom", "whose", "that",
  "because", "although", "though", "while", "since", "unless", "if", "as", "when", "where",
  "of", "in", "on", "at", "for", "with", "without", "to", "from", "by", "about", "like", "than",
]);

const AUX_VERBS = new Set([
  "is", "are", "was", "were", "be", "been", "being",
  "has", "have", "had", "will", "would", "can", "could", "should", "must", "may", "might",
  "do", "does", "did",
]);

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Text since the last sentence-ending punctuation (or the start). */
function tailClause(s: string): string {
  const match = /[.!?][^.!?]*$/.exec(s);
  return match ? match[0].slice(1) : s;
}

/** Text up to the first sentence-ending punctuation (or the end). */
function headClause(s: string): string {
  const match = /^[^.!?]*/.exec(s);
  return match ? match[0] : s;
}

function firstWord(s: string): string {
  const match = /[a-zA-Z']+/.exec(s);
  return match ? match[0].toLowerCase() : "";
}

// Cheap, imperfect stand-in for "does this clause have a finite verb":
// checks for a modal/auxiliary, or a word ending in -ed/-ing/-s that's
// likely a conjugated verb rather than a plural noun or a short function
// word. Misses e.g. past-participle-as-adjective ("a self-directed path"),
// which is a known, accepted limitation — see sanitizeReadingText() doc.
function hasLikelyVerb(clause: string): boolean {
  const words = clause.toLowerCase().match(/[a-z']+/g) ?? [];
  return words.some(
    (w) => AUX_VERBS.has(w) || ((w.endsWith("ed") || w.endsWith("ing") || w.endsWith("s")) && w.length > 3),
  );
}

function looksLikeFreshClause(right: string): boolean {
  const head = headClause(right);
  const fw = firstWord(head);
  return fw !== "" && !CONTINUATION_STARTERS.has(fw) && hasLikelyVerb(head);
}

function capitalize(s: string): string {
  const trimmed = s.trimStart();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function collapseArtifacts(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\.\s*\.+/g, ".")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*,/g, ".")
    .trim();
}

/**
 * Safety-net cleanup for model output: prompts alone don't fully stop a
 * small/free model from reaching for em dashes as punctuation, so this
 * rewrites them (and spaced double-hyphens used the same way) into commas
 * or periods instead.
 *
 * Deliberately biased toward commas: an em dash overwhelmingly introduces
 * an aside or appositive in this kind of warm, descriptive prose ("a rare
 * fire hand — with a heart line that surprised us"), and a wrong comma
 * reads far better than a wrong period turning a sentence fragment into
 * its own "sentence." A period is only used when the text after the dash
 * both (a) doesn't open with a conjunction/relative-pronoun/preposition/
 * article and (b) has what looks like its own finite verb — two full
 * independent clauses.
 *
 * This is a word-pattern heuristic, not real grammar parsing, so it isn't
 * perfect (a past participle used as an adjective, e.g. "a self-directed
 * path," can still misfire) — worth spot-checking on real generations
 * rather than trusting blindly. Idempotent, so re-running it on
 * already-clean text (e.g. Detailed Reading text gets a pass both here and
 * again via lib/parse.ts's per-field parsing) is harmless.
 */
export function sanitizeReadingText(text: string): string {
  if (!text) return text;

  const parts = text.split(DASH_PUNCTUATION);
  if (parts.length === 1) return collapseArtifacts(text);

  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const left = out;
    const right = parts[i];
    const bothLookComplete =
      wordCount(tailClause(left)) >= 6 &&
      wordCount(headClause(right)) >= 5 &&
      looksLikeFreshClause(right);
    out = bothLookComplete
      ? `${left.replace(/\s+$/, "")}. ${capitalize(right)}`
      : `${left.replace(/\s+$/, "")}, ${right.trimStart()}`;
  }
  return collapseArtifacts(out);
}
