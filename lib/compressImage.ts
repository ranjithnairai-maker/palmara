export interface CompressedImage {
  /** `data:image/jpeg;base64,...` — ready to POST. */
  dataUrl: string;
  width: number;
  height: number;
  /** Approx byte size of the encoded image. */
  bytes: number;
}

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25MB before compression

interface Options {
  maxEdge?: number;
  quality?: number;
}

/**
 * Loads an image File, scales its longest edge down to `maxEdge`, and
 * re-encodes it as JPEG. Runs entirely in the browser to keep uploads small.
 */
export async function compressImage(
  file: File,
  { maxEdge = 1200, quality = 0.82 }: Options = {},
): Promise<CompressedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("That image is very large — try one under 25MB.");
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked image processing.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) (bitmap as ImageBitmap).close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (!dataUrl.startsWith("data:image/jpeg")) {
    throw new Error("Could not process that image. Try another photo.");
  }

  return {
    dataUrl,
    width,
    height,
    bytes: Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 0.75),
  };
}

/** Re-encode a canvas/blob source (e.g. a camera frame) that's already sized. */
export function canvasToCompressed(
  canvas: HTMLCanvasElement,
  quality = 0.82,
): CompressedImage {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    bytes: Math.round((dataUrl.length - 23) * 0.75),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decode
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
