import { supabaseAdmin, PALM_BUCKET } from "./supabase";
import type { Reading, ReadingMessage } from "./types";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export interface DecodedImage {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Parses a `data:<mime>;base64,<data>` URL into a buffer. */
export function decodeDataUrl(dataUrl: string): DecodedImage {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
    dataUrl.trim(),
  );
  if (!match) {
    throw new Error("Expected a base64 JPEG, PNG, or WebP data URL.");
  }
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, contentType, ext: MIME_EXT[contentType] ?? "jpg" };
}

export async function uploadPalmImage(
  readingId: string,
  img: DecodedImage,
): Promise<string> {
  const path = `${readingId}/palm.${img.ext}`;
  const { error } = await supabaseAdmin.storage
    .from(PALM_BUCKET)
    .upload(path, img.buffer, {
      contentType: img.contentType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function createReading(imagePath: string): Promise<Reading> {
  const { data, error } = await supabaseAdmin
    .from("readings")
    .insert({ image_path: imagePath, status: "processing", reading_text: "" })
    .select()
    .single();
  if (error) throw new Error(`Insert reading failed: ${error.message}`);
  return data as Reading;
}

export async function updateReading(
  id: string,
  patch: Partial<
    Pick<Reading, "hand_element" | "reading_text" | "status" | "image_path">
  >,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("readings")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(`Update reading failed: ${error.message}`);
}

export async function addMessage(
  readingId: string,
  role: "user" | "assistant",
  content: string,
): Promise<ReadingMessage> {
  const { data, error } = await supabaseAdmin
    .from("reading_messages")
    .insert({ reading_id: readingId, role, content })
    .select()
    .single();
  if (error) throw new Error(`Insert message failed: ${error.message}`);
  return data as ReadingMessage;
}

export async function getReading(id: string): Promise<Reading | null> {
  const { data, error } = await supabaseAdmin
    .from("readings")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Fetch reading failed: ${error.message}`);
  return (data as Reading) ?? null;
}

export async function getMessages(readingId: string): Promise<ReadingMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("reading_messages")
    .select()
    .eq("reading_id", readingId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Fetch messages failed: ${error.message}`);
  return (data as ReadingMessage[]) ?? [];
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Downloads a stored palm image and returns it as a base64 data URL. */
export async function loadStoredImageAsDataUrl(
  imagePath: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(PALM_BUCKET)
    .download(imagePath);
  if (error || !data) return null;
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = MIME_BY_EXT[ext] ?? "image/jpeg";
  const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  return `data:${mime};base64,${base64}`;
}

export async function getSignedImageUrl(
  imagePath: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(PALM_BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

/** UUID v4 shape check for route params. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
