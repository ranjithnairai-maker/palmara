export type ReadingStatus = "processing" | "complete" | "failed";

export type HandElement = "Earth" | "Air" | "Fire" | "Water";

export interface Reading {
  id: string;
  created_at: string;
  image_path: string;
  hand_element: string | null;
  reading_text: string;
  status: ReadingStatus;
}

export interface ReadingMessage {
  id: string;
  reading_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Shape returned by GET /api/readings/[id] */
export interface ReadingPayload {
  reading: Reading;
  messages: ReadingMessage[];
  imageUrl: string | null;
  /** Present when status is 'failed' — a friendly reason for the UI. */
  failureReason?: string | null;
}

/** Parsed result of the vision model's structured reply. */
export interface ParsedReading {
  isPalm: boolean;
  handElement: string | null;
  reading: string;
  clarification: string | null;
}
