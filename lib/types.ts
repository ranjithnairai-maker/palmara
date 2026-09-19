export type ReadingStatus = "processing" | "complete" | "failed";

export type HandElement = "Earth" | "Air" | "Fire" | "Water";

export interface AnalysisLine {
  traits: string;
  takeaway: string;
}

/** Structured output of the (single) vision-model analysis call. */
export interface AnalysisJson {
  hand_element: string | null;
  lines: {
    life: AnalysisLine;
    heart: AnalysisLine;
    head: AnalysisLine;
    fate: AnalysisLine;
  };
  mounts: string;
  /** Short (8-12 word), curiosity-driving title for this specific reading —
   * used as the share-link preview title (see app/r/[id]/opengraph-image.tsx). */
  headline: string;
  /** 5 follow-up questions grounded in this specific palm, shown as chips
   * under the reading (see ReadingView.tsx). Empty on readings generated
   * before this field existed — callers should fall back to
   * SUGGESTED_QUESTIONS in lib/prompts.ts when empty. */
  suggestedQuestions: string[];
}

/** Structured output of the on-demand Detailed Reading call. */
export interface DetailedSections {
  handElement: string;
  vitality: string;
  love: string;
  mind: string;
  path: string;
  mounts: string;
  closing: string;
}

export interface Reading {
  id: string;
  created_at: string;
  image_path: string | null;
  hand_element: string | null;
  /** Quick Insights prose (markdown). Repurposed from the original single-tier reading. */
  reading_text: string;
  status: ReadingStatus;
  analysis_json: AnalysisJson | null;
  /** Detailed Reading — raw text (usually JSON-encoded DetailedSections); null until revealed. */
  detailed_text: string | null;
  /** null (not started) | 'processing' (background generation in flight) | a
   * failure message. Generation runs fire-and-forget (see
   * app/api/readings/[id]/detailed/route.ts) because it can take longer
   * than a single HTTP request should block on — the client polls this via
   * GET /api/readings/[id] instead of waiting on the POST response. */
  detailed_status: string | null;
  /** Proves ownership for manual delete. Server-only — never sent to the client after creation. */
  owner_token: string;
  image_deleted_at: string | null;
  /** Set when a /generate attempt claims the row (see lib/readings.ts
   * claimGeneration) — an expiring lease so a second concurrent or
   * duplicate request can't start a second, redundant model call while one
   * is already in flight, but a crashed/abandoned attempt can still be
   * recovered after it expires. Not meaningful to clients; harmless to
   * expose since it's just a timestamp. */
  generation_claimed_at: string | null;
}

/** Reading shape safe to send to any viewer — owner_token stripped. */
export type PublicReading = Omit<Reading, "owner_token">;

export interface ReadingMessage {
  id: string;
  reading_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Shape returned by GET /api/readings/[id] and rendered by ReadingView. */
export interface ReadingPayload {
  reading: PublicReading;
  messages: ReadingMessage[];
  imageUrl: string | null;
  /** Detailed Reading, pre-parsed server-side (lib/parse.ts is server-only —
   * see CLAUDE.md conventions). Null if not yet generated, or if the raw
   * detailed_text didn't parse as structured JSON (client then falls back
   * to rendering reading.detailed_text as plain markdown). */
  detailedSections: DetailedSections | null;
  /** Present when status is 'failed' — a friendly reason for the UI. */
  failureReason?: string | null;
}

/** Parsed result of the vision model's structured analysis reply. */
export interface ParsedAnalysis {
  isPalm: boolean;
  analysis: AnalysisJson | null;
  clarification: string | null;
}
