"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ShareGlyph } from "./ShareGlyph";
import { pickShareMessage } from "@/lib/shareMessages";

type Props = { shareUrl: string; size?: "default" | "sm" };

type SocialKind = "whatsapp" | "facebook" | "linkedin" | "reddit" | "instagram";
type UtilityKind = "copy" | "qr";

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Instagram has no web link that opens a pre-filled post or story caption,
 * so this is deliberately the clunkiest option: copy a ready-to-paste
 * caption, then hand off to the app (mobile) or instagram.com (desktop).
 * The `instagram://app` deep link is a silent no-op if the app isn't
 * installed, hence the visibility-based fallback to the website shortly
 * after — a common pattern for this kind of soft app handoff.
 */
function openInstagram() {
  const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
  if (!isMobile) {
    openInNewTab("https://www.instagram.com/");
    return;
  }
  window.location.href = "instagram://app";
  setTimeout(() => {
    if (!document.hidden) openInNewTab("https://www.instagram.com/");
  }, 1200);
}

const SOCIAL_ROWS: { kind: SocialKind; label: string }[] = [
  { kind: "whatsapp", label: "WhatsApp" },
  { kind: "facebook", label: "Facebook" },
  { kind: "linkedin", label: "LinkedIn" },
  { kind: "reddit", label: "Reddit" },
  { kind: "instagram", label: "Instagram" },
];

// Called out separately from the social rows above, each with its own
// one-line caption — these two got lost among the platform icons before,
// so here they're deliberately louder and explicit about what they do.
const UTILITY_ROWS: { kind: UtilityKind; label: string; caption: string }[] = [
  { kind: "copy", label: "Copy Link", caption: "Copy the reading's URL to your clipboard" },
  { kind: "qr", label: "QR Code", caption: "Show a code to scan from another device" },
];

/**
 * Replaces the old plain "Copy share link" button. On a device with the Web
 * Share API (most phones), the OS's own share sheet is the primary path —
 * it already puts WhatsApp, Messages, Instagram etc. right there, and
 * usually handles text + link better than any single platform link can.
 * The panel below is the fallback for everywhere else (desktop browsers,
 * mostly), plus it's the only place Instagram's copy-caption flow and the
 * QR code live, since neither has a share-sheet equivalent.
 *
 * Not all five platform buttons behave the same way — see the doc comments
 * on the per-platform functions below before changing one. Facebook and
 * LinkedIn ignore custom share text in practice (their dialogs only surface
 * the page's Open Graph title, which is why the share images/metadata from
 * earlier updates matter); WhatsApp and Reddit genuinely accept pre-filled
 * text; Instagram accepts none at all.
 */
export function SharePanel({ shareUrl, size = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "qr">("menu");
  const [status, setStatus] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // One message per panel-open, not one per row click — so if someone opens
  // the panel and tries two platforms, both get the same line instead of
  // looking like two different people wrote them.
  const messageRef = useRef(pickShareMessage());

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleTriggerClick() {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Palmistica", text: pickShareMessage(), url: shareUrl });
        return;
      } catch (err) {
        // AbortError just means the person closed the OS share sheet —
        // leave them there rather than also popping our own panel.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    messageRef.current = pickShareMessage();
    setStatus(null);
    setView("menu");
    setOpen((o) => !o);
  }

  async function handleSocialRow(kind: SocialKind) {
    const message = messageRef.current;
    switch (kind) {
      case "whatsapp":
        openInNewTab(`https://wa.me/?text=${encodeURIComponent(`${message} ${shareUrl}`)}`);
        break;
      case "reddit":
        openInNewTab(
          `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(message)}`,
        );
        break;
      case "facebook":
        // No custom-text param here on purpose — Facebook ignores it and
        // shows the page's Open Graph title/image instead.
        openInNewTab(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
        break;
      case "linkedin":
        // Same story as Facebook: LinkedIn's dialog only surfaces Open
        // Graph metadata, not a passed-in quote/text param.
        openInNewTab(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`);
        break;
      case "instagram": {
        const copied = await copyText(`${message} ${shareUrl}`);
        setStatus(
          copied
            ? "Caption copied ✓ — paste it into your post or story"
            : "Couldn't copy the caption — opening Instagram anyway",
        );
        openInstagram();
        return; // keep the panel open so the status line is visible
      }
    }
    setOpen(false);
  }

  async function handleUtilityRow(kind: UtilityKind) {
    if (kind === "copy") {
      const copied = await copyText(shareUrl);
      setStatus(copied ? "Link copied ✓" : "Couldn't copy the link");
      return; // keep the panel open so the status line is visible
    }
    // kind === "qr"
    setView("qr");
    if (!qrDataUrl && !qrError) {
      try {
        const dataUrl = await QRCode.toDataURL(shareUrl, {
          width: 220,
          margin: 1,
          color: { dark: "#0b0a12", light: "#f3eee4" },
        });
        setQrDataUrl(dataUrl);
      } catch {
        setQrError(true);
      }
    }
  }

  const triggerClassName =
    size === "sm" ? "btn-ghost !px-3.5 !py-1.5 text-[11px]" : "btn-ghost !py-2 text-xs";
  const triggerIconClassName = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="true"
        aria-expanded={open}
        className={triggerClassName}
      >
        <ShareGlyph kind="share" className={triggerIconClassName} />
        Share with Friends
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="mystic-card absolute right-0 top-[calc(100%+0.6rem)] z-20 w-64 p-2.5"
        >
          {view === "menu" ? (
            <>
              {SOCIAL_ROWS.map((row) => (
                <button
                  key={row.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSocialRow(row.kind)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-cream transition-colors hover:bg-[rgba(217,178,94,0.1)]"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[rgba(217,178,94,0.35)] bg-[rgba(61,31,79,0.35)] text-gold">
                    <ShareGlyph kind={row.kind} className="h-3.5 w-3.5" />
                  </span>
                  {row.label}
                </button>
              ))}

              <hr className="hairline my-1.5" />

              {UTILITY_ROWS.map((row) => (
                <button
                  key={row.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => handleUtilityRow(row.kind)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[rgba(217,178,94,0.1)]"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[rgba(217,178,94,0.45)] bg-[rgba(61,31,79,0.35)] text-gold">
                    <ShareGlyph kind={row.kind} className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gold-bright">
                      {row.label}
                    </span>
                    <span className="block text-[11px] leading-tight text-cream-faint">
                      {row.caption}
                    </span>
                  </span>
                </button>
              ))}

              {status && (
                <p className="mt-1 border-t border-[rgba(217,178,94,0.14)] px-3 pt-2.5 text-xs text-gold">
                  {status}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center px-2 py-2 text-center">
              <p className="text-sm font-semibold text-gold-bright">QR Code</p>
              <p className="mt-1 text-[11px] leading-relaxed text-cream-faint">
                Scan this with another phone or camera to open the reading.
              </p>
              <div className="mt-3 grid h-[220px] w-[220px] place-items-center overflow-hidden rounded-xl border border-[rgba(217,178,94,0.3)] bg-[#f3eee4]">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR code linking to this reading" width={220} height={220} />
                ) : qrError ? (
                  <p className="px-4 text-xs text-[#8a2f2f]">Couldn&rsquo;t generate the code</p>
                ) : (
                  <p className="text-xs text-[#0b0a12]/60">Generating…</p>
                )}
              </div>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download="palmistica-reading-qr.png"
                  className="mt-3 text-xs text-gold underline decoration-[rgba(217,178,94,0.4)] underline-offset-4 hover:text-gold-bright"
                >
                  Download QR code
                </a>
              )}
              <button
                type="button"
                onClick={() => setView("menu")}
                className="btn-ghost mt-4 !px-4 !py-1.5 text-[11px]"
              >
                Back
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
