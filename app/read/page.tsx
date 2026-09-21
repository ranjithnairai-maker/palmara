"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MysticLoader } from "@/components/MysticLoader";
import {
  compressImage,
  canvasToCompressed,
  type CompressedImage,
} from "@/lib/compressImage";

type Mode = "choose" | "camera" | "preview" | "processing";

const TIPS = [
  "Open your hand fully, palm toward the camera.",
  "Find soft, even light — no harsh shadows or flash glare.",
  "Fill most of the frame with your palm, and hold steady.",
  "Either hand is fine. Most readers favour the one you write with.",
];

export default function ReadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [image, setImage] = useState<CompressedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped whenever a camera request is cancelled (Cancel button, or
  // unmount) while getUserMedia() is still pending — the async permission
  // prompt can resolve well after the user's already backed out, and
  // without this guard that late resolution would store + display a live
  // stream behind a UI that's already moved back to "choose".
  const cameraRequestIdRef = useRef(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      // cameraRequestIdRef is a plain counter, not a DOM node ref — the
      // lint rule's "node rendered by React" warning here is a false
      // positive for this pattern.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cameraRequestIdRef.current++;
      stopCamera();
    };
  }, [stopCamera]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setMode("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    setError(null);
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't open the camera. Upload a photo instead.");
      return;
    }
    setMode("camera");
    const requestId = ++cameraRequestIdRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 } },
        audio: false,
      });
      if (cameraRequestIdRef.current !== requestId) {
        // Cancelled (or unmounted) while the permission prompt was pending —
        // don't leave this stream's camera light on behind a UI that's
        // already moved on.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      if (cameraRequestIdRef.current !== requestId) return;
      stopCamera();
      setMode("choose");
      setCameraError(
        "Camera access was blocked. You can allow it in your browser settings, or just upload a photo.",
      );
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxEdge = 1200;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImage(canvasToCompressed(canvas));
    stopCamera();
    setMode("preview");
  }

  function retake() {
    setImage(null);
    setError(null);
    setMode("choose");
  }

  async function submit() {
    if (!image) return;
    setError(null);
    setMode("processing");
    try {
      // 1. Fast: store the image and create the reading row.
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: image.dataUrl }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.id) {
        setError(
          data.error ?? "Couldn't start the reading. Please try again.",
        );
        setMode("preview");
        return;
      }

      // Stash the owner token so this browser can delete the reading later.
      // Best-effort: a private window or blocked storage just means no
      // delete control shows up, nothing else in the flow depends on it.
      if (data.ownerToken) {
        try {
          localStorage.setItem(`palmistica_owner_${data.id}`, data.ownerToken);
        } catch {
          /* storage unavailable — delete control just won't show later */
        }
      }

      // 2. Kick off the slow vision call without blocking navigation.
      //    keepalive lets it survive the route change.
      fetch(`/api/readings/${data.id}/generate`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});

      // 3. The reading page shows the loader and polls until it's ready.
      router.push(`/reading/${data.id}`);
    } catch {
      setError("Network trouble reaching the reader. Please try again.");
      setMode("preview");
    }
  }

  return (
    <>
      <SiteHeader showCta={false} />
      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 py-12">
        {mode === "processing" ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <MysticLoader />
          </div>
        ) : (
          <div className="w-full animate-fade-up">
            <div className="text-center">
              <p className="eyebrow">Begin</p>
              <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
                Show Palmistica your palm
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream-muted">
                Upload a photo or take one now. You&rsquo;ll see it before
                anything is sent.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-[rgba(217,120,120,0.35)] bg-[rgba(120,40,40,0.15)] px-4 py-3 text-sm text-[#f0c9c9]">
                {error}
              </div>
            )}

            {/* CHOOSE */}
            {mode === "choose" && (
              <div className="mt-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="mystic-card flex flex-col items-center gap-3 p-8 text-center transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    <span className="text-2xl text-gold">⬆</span>
                    <span className="font-serif text-lg text-cream">
                      Upload a photo
                    </span>
                    <span className="text-xs text-cream-faint">
                      From your device or a synced folder
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={busy}
                    className="mystic-card flex flex-col items-center gap-3 p-8 text-center transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    <span className="text-2xl text-gold">◉</span>
                    <span className="font-serif text-lg text-cream">
                      Take a photo
                    </span>
                    <span className="text-xs text-cream-faint">
                      Use your camera right now
                    </span>
                  </button>
                </div>
                {busy && (
                  <p className="mt-4 text-center text-xs text-cream-faint">
                    Preparing your image…
                  </p>
                )}
                {cameraError && (
                  <p className="mt-4 text-center text-xs text-[#f0c9c9]">
                    {cameraError}
                  </p>
                )}

                <div className="mystic-card mt-8 p-6">
                  <p className="eyebrow">For a clear reading</p>
                  <ul className="mt-3 space-y-2">
                    {TIPS.map((tip) => (
                      <li
                        key={tip}
                        className="flex gap-2 text-sm leading-relaxed text-cream-muted"
                      >
                        <span className="text-gold">✦</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* CAMERA */}
            {mode === "camera" && (
              <div className="mt-8">
                <div className="overflow-hidden rounded-2xl border border-[rgba(217,178,94,0.25)] bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      cameraRequestIdRef.current++;
                      stopCamera();
                      setMode("choose");
                    }}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button type="button" onClick={capturePhoto} className="btn-gold">
                    Capture
                  </button>
                </div>
              </div>
            )}

            {/* PREVIEW */}
            {mode === "preview" && image && (
              <div className="mt-8">
                <div className="overflow-hidden rounded-2xl border border-[rgba(217,178,94,0.25)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.dataUrl}
                    alt="Your palm, ready to read"
                    className="max-h-[60vh] w-full object-contain bg-black"
                  />
                </div>
                <p className="mt-3 text-center text-xs text-cream-faint">
                  {image.width}×{image.height} · ~{Math.max(1, Math.round(image.bytes / 1024))} KB
                </p>
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button type="button" onClick={retake} className="btn-ghost">
                    Retake / reupload
                  </button>
                  <button type="button" onClick={submit} className="btn-gold">
                    Read my palm
                  </button>
                </div>
              </div>
            )}

            <div className="mt-10 text-center">
              <p className="text-xs tracking-wide text-cream-faint">
                Want a companion while you read?{" "}
                <Link
                  href="/ebook"
                  className="underline decoration-[rgba(217,178,94,0.4)] underline-offset-2 hover:text-gold"
                >
                  Get the full guide for $1
                </Link>
                .
              </p>
              <Link
                href="/"
                className="mt-3 inline-block text-xs tracking-wide text-cream-faint underline-offset-4 hover:text-gold"
              >
                ← Back to the start
              </Link>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
        />
      </main>
      <SiteFooter />
    </>
  );
}
