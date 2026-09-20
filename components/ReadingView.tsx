"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MysticLoader } from "./MysticLoader";
import { PalmMarkdown } from "./PalmMarkdown";
import { PalmGlyph } from "./PalmGlyph";
import { SectionGlyph } from "./SectionGlyph";
import { TipJar } from "./TipJar";
import { SharePanel } from "./SharePanel";
import { DeleteReadingControl } from "./DeleteReadingControl";
import { SUGGESTED_QUESTIONS } from "@/lib/prompts";
import type { DetailedSections, ReadingMessage, ReadingPayload } from "@/lib/types";

type Props = {
  initial: ReadingPayload;
  shareId: string;
  /** Read-only public share view: no chat input, no share tools. */
  readOnly?: boolean;
};

const THEMES: { key: keyof Omit<DetailedSections, "handElement" | "mounts" | "closing">; title: string }[] = [
  { key: "vitality", title: "Vitality" },
  { key: "love", title: "Love" },
  { key: "mind", title: "Mind" },
  { key: "path", title: "Path" },
];

export function ReadingView({ initial, shareId, readOnly = false }: Props) {
  const router = useRouter();
  const [payload, setPayload] = useState<ReadingPayload>(initial);
  const { reading, detailedSections } = payload;

  // Chat state (skip messages[0] — that's Quick Insights, shown above).
  const [chat, setChat] = useState<ReadingMessage[]>(() =>
    payload.messages.slice(1),
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  // "Triggering" covers only the brief window between clicking Reveal and
  // the kickoff POST responding; the actual generation is tracked via
  // reading.detailed_status (see the polling effect below), since it runs
  // in the background rather than inside that POST's response.
  const [triggeringDetailed, setTriggeringDetailed] = useState(false);
  const [detailedWaitedTooLong, setDetailedWaitedTooLong] = useState(false);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  // A plain incrementing counter, not Date.now()/crypto.randomUUID() — the
  // React Compiler's purity lint rule flags any impure call reachable from
  // a component function, even one that (like this) only ever runs inside
  // an event handler, never during render.
  const tmpMessageIdRef = useRef(0);
  // Guards against the 3s poll interval firing a new fetch before the
  // previous one has resolved (a slow response, or several ticks queuing up
  // behind one another) — without this, overlapping requests can land out
  // of order and an older response can overwrite newer state.
  const fetchingRef = useRef(false);

  const refetch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch(`/api/readings/${shareId}`, { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as ReadingPayload;
      setPayload(next);
      setChat(next.messages.slice(1));
    } finally {
      fetchingRef.current = false;
    }
  }, [shareId]);

  // Poll while a reading is still being generated.
  useEffect(() => {
    if (reading.status !== "processing") return;
    let ticks = 0;
    const t = setInterval(() => {
      ticks += 1;
      if (ticks > 28) setWaitedTooLong(true); // ~85s with no result
      refetch();
    }, 3000);
    return () => clearInterval(t);
  }, [reading.status, refetch]);

  // Poll while the Detailed Reading is generating in the background — it
  // can take 20-50+ seconds on the free model, too long to hold the
  // kickoff request open for, so /detailed returns immediately and this
  // effect watches reading.detailed_status via the same refetch used above.
  const isRevealingDetailed =
    reading.detailed_status === "processing" && !reading.detailed_text;
  useEffect(() => {
    // detailedWaitedTooLong itself resets at the start of each revealDetailed()
    // attempt, not here — this effect only needs to arm the bail-out timer
    // while a generation is actually in flight.
    if (!isRevealingDetailed) return;
    let ticks = 0;
    const t = setInterval(() => {
      ticks += 1;
      if (ticks > 20) setDetailedWaitedTooLong(true); // ~60s with no result
      refetch();
    }, 3000);
    return () => clearInterval(t);
  }, [isRevealingDetailed, refetch]);

  useEffect(() => {
    if (chat.length) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chat.length, sending]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/r/${shareId}`;
    return `${window.location.origin}/r/${shareId}`;
  }, [shareId]);

  // Readings generated before analysis_json carried suggested_questions
  // (or where the model just didn't return any) fall back to the static
  // list rather than showing no chips at all.
  const suggestedQuestions =
    reading.analysis_json?.suggestedQuestions?.length
      ? reading.analysis_json.suggestedQuestions
      : SUGGESTED_QUESTIONS;

  async function sendQuestion(question: string) {
    const text = question.trim();
    if (!text || sending) return;
    setChatError(null);
    setSending(true);
    const optimistic: ReadingMessage = {
      id: `tmp-${tmpMessageIdRef.current++}`,
      reading_id: shareId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setChat((c) => [...c, optimistic]);
    setDraft("");

    try {
      const res = await fetch(`/api/readings/${shareId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChat((c) => c.filter((m) => m.id !== optimistic.id));
        setDraft(text);
        setChatError(data.error ?? "That didn't go through. Try again.");
        return;
      }
      setChat((c) => [
        ...c.filter((m) => m.id !== optimistic.id),
        data.userMessage as ReadingMessage,
        data.message as ReadingMessage,
      ]);
    } catch {
      setChat((c) => c.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setChatError("Network trouble reaching the reader. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function retry() {
    setRetrying(true);
    setChatError(null);
    setWaitedTooLong(false);
    setPayload((p) => ({
      ...p,
      reading: { ...p.reading, status: "processing" },
    }));
    try {
      await fetch(`/api/readings/${shareId}/generate`, { method: "POST" });
    } catch {
      /* the poll loop will surface the outcome */
    } finally {
      await refetch();
      setRetrying(false);
    }
  }

  async function revealDetailed() {
    setTriggeringDetailed(true);
    setDetailedWaitedTooLong(false);
    setDetailedError(null);
    try {
      const res = await fetch(`/api/readings/${shareId}/detailed`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailedError(data.error ?? "That didn't come through. Try again.");
        return;
      }
      if (data.status === "complete") {
        // Already generated earlier (idempotent) — no need to poll.
        setPayload((p) => ({
          ...p,
          reading: { ...p.reading, detailed_text: data.detailedText, detailed_status: null },
          detailedSections: data.detailedSections ?? null,
        }));
      } else {
        // Kicked off in the background — reflect that immediately so the
        // polling effect starts without waiting for a refetch round trip.
        setPayload((p) => ({
          ...p,
          reading: { ...p.reading, detailed_status: "processing" },
        }));
      }
    } catch {
      setDetailedError("Network trouble reaching the reader. Try again.");
    } finally {
      setTriggeringDetailed(false);
    }
  }

  // ---- Processing ---------------------------------------------------------
  if (reading.status === "processing") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <MysticLoader />
        {waitedTooLong && !readOnly && (
          <div className="mt-10 max-w-sm text-center">
            <p className="text-sm text-cream-muted">
              Analyzing is taking a while. You can nudge it to try again.
            </p>
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="btn-ghost mt-4 disabled:opacity-60"
            >
              {retrying ? "Nudging…" : "Nudge the reader"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- Failed -----------------------------------------------------------
  if (reading.status === "failed") {
    const notAPalm = reading.reading_text.startsWith("NOT_A_PALM:");
    const reason = notAPalm
      ? reading.reading_text.replace(/^NOT_A_PALM:\s*/, "")
      : null;
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mystic-card p-10">
          <p className="eyebrow">{notAPalm ? "Hmm" : "A pause"}</p>
          <h1 className="mt-3 font-serif text-2xl text-cream">
            {notAPalm
              ? "That didn't look like a palm"
              : "The reading didn’t come through"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-cream-muted">
            {reason ??
              "Analyzing can be slow or busy at times. Your photo is saved — try once more."}
          </p>
          {!readOnly && (
            <div className="mt-7 flex flex-col items-center gap-3">
              {!notAPalm && (
                <button
                  type="button"
                  onClick={retry}
                  disabled={retrying}
                  className="btn-gold disabled:opacity-60"
                >
                  {retrying ? "Trying again…" : "Try the reading again"}
                </button>
              )}
              <Link
                href="/read"
                className={
                  notAPalm
                    ? "btn-gold"
                    : "text-xs text-cream-faint hover:text-gold"
                }
              >
                Start over with a new photo
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Complete -------------------------------------------------------
  const createdAt = new Date(reading.created_at).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const hasDetailed = Boolean(reading.detailed_text);

  return (
    <div className="animate-fade-up">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(217,178,94,0.14)] pb-6">
        <div className="flex items-center gap-3">
          {reading.hand_element && (
            <span className="rounded-full border border-[rgba(217,178,94,0.4)] bg-[rgba(61,31,79,0.35)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              {reading.hand_element} hand
            </span>
          )}
          <span className="text-xs tracking-wide text-cream-faint">
            {createdAt}
          </span>
        </div>

        {!readOnly && <SharePanel shareUrl={shareUrl} />}
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,320px)_1fr]">
        {/* Palm image */}
        <div className="md:sticky md:top-24 md:self-start">
          <div className="mystic-card overflow-hidden p-2">
            {payload.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={payload.imageUrl}
                alt="The palm that was read"
                className="w-full rounded-lg object-contain"
              />
            ) : reading.image_deleted_at ? (
              <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-4 rounded-lg bg-black/30 p-6 text-center">
                <PalmGlyph className="w-16 opacity-40" />
                <p className="text-xs leading-relaxed text-cream-faint">
                  the original photo has aged out, but the reading remains
                </p>
              </div>
            ) : (
              <div className="grid aspect-[3/4] w-full place-items-center rounded-lg bg-black text-xs text-cream-faint">
                image unavailable
              </div>
            )}
          </div>
          {!readOnly && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-cream-faint">
              Anyone with your share link can see this reading.
            </p>
          )}
        </div>

        {/* Reading + chat */}
        <div>
          <p className="eyebrow">Quick Insights</p>
          <div className="mt-3">
            <PalmMarkdown>{reading.reading_text}</PalmMarkdown>
          </div>

          {!hasDetailed && isRevealingDetailed && (
            <div className="mt-10 rounded-2xl border border-[rgba(217,178,94,0.3)] bg-[rgba(61,31,79,0.25)] p-8 text-center">
              <p className="eyebrow">Weaving it together</p>
              <h3 className="mt-2 font-serif text-xl text-cream">
                Revealing Your Full Reading…
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-cream-muted">
                Analyzing can take up to a minute for the long version.
              </p>
              {detailedWaitedTooLong && (
                <button
                  type="button"
                  onClick={revealDetailed}
                  disabled={triggeringDetailed}
                  className="btn-ghost mt-6 disabled:opacity-60"
                >
                  {triggeringDetailed ? "Nudging…" : "Still going — nudge it"}
                </button>
              )}
            </div>
          )}

          {!hasDetailed && !isRevealingDetailed && (
            <div className="mt-10 rounded-2xl border border-[rgba(217,178,94,0.3)] bg-[rgba(61,31,79,0.25)] p-8 text-center">
              <p className="eyebrow">There is more</p>
              <h3 className="mt-2 font-serif text-xl text-cream">
                Reveal Your Full Reading
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-cream-muted">
                An unhurried telling of your hand — Vitality, Love, Mind, and
                Path, woven into one fuller reflection.
              </p>
              <button
                type="button"
                onClick={revealDetailed}
                disabled={triggeringDetailed}
                className="btn-gold mt-6 disabled:opacity-60"
              >
                {triggeringDetailed ? "Starting…" : "Reveal Your Full Reading"}
              </button>
              {(detailedError ||
                (reading.detailed_status && reading.detailed_status !== "processing")) && (
                <p className="mt-3 text-xs text-[#f0c9c9]">
                  {detailedError ?? reading.detailed_status}
                </p>
              )}
            </div>
          )}

          {hasDetailed && (
            <div className="mt-12 animate-fade-up">
              <hr className="hairline mb-10" />
              <p className="eyebrow">Your Full Reading</p>

              {detailedSections ? (
                <>
                  <div className="mt-4">
                    <PalmMarkdown>{detailedSections.handElement}</PalmMarkdown>
                  </div>

                  {THEMES.map((theme) => (
                    <div key={theme.key} className="mt-10">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(217,178,94,0.4)] bg-[rgba(61,31,79,0.35)] text-gold">
                          <SectionGlyph kind={theme.key} className="h-4.5 w-4.5" />
                        </span>
                        <h3 className="font-serif text-xl tracking-wide text-gold-bright">
                          {theme.title}
                        </h3>
                      </div>
                      <hr className="hairline mb-4 mt-3 max-w-[6rem]" />
                      <PalmMarkdown>{detailedSections[theme.key]}</PalmMarkdown>
                    </div>
                  ))}

                  {detailedSections.mounts && (
                    <div className="mt-10">
                      <p className="eyebrow !text-[0.65rem]">Mounts</p>
                      <div className="mt-2">
                        <PalmMarkdown>{detailedSections.mounts}</PalmMarkdown>
                      </div>
                    </div>
                  )}

                  <div className="mt-10 rounded-2xl border border-[rgba(217,178,94,0.2)] bg-[rgba(61,31,79,0.2)] p-6">
                    <PalmMarkdown>{detailedSections.closing}</PalmMarkdown>
                  </div>
                </>
              ) : (
                // Model didn't return valid structured JSON — fall back to
                // rendering whatever it returned as plain markdown, same
                // tolerant-parsing philosophy as the rest of the app.
                <div className="mt-4">
                  <PalmMarkdown>{reading.detailed_text ?? ""}</PalmMarkdown>
                </div>
              )}
            </div>
          )}

          <TipJar />

          <hr className="hairline my-10" />

          <p className="eyebrow">The conversation</p>
          {readOnly && chat.length === 0 && (
            <p className="mt-3 text-sm text-cream-faint">
              No follow-up questions were asked on this reading.
            </p>
          )}

          {!readOnly && chat.length === 0 && (
            <p className="mt-3 text-sm leading-relaxed text-cream-muted">
              Ask Palmistica anything the reading left open — the mounts, your
              fingers, the smaller lines, or what a line means for one part of
              your life.
            </p>
          )}

          {/* Suggested questions */}
          {!readOnly && (
            <div className="mt-5 flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => sendQuestion(q)}
                  className="rounded-full border border-[rgba(217,178,94,0.25)] bg-[rgba(11,10,18,0.5)] px-3.5 py-1.5 text-xs text-cream-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Transcript */}
          {chat.length > 0 && (
            <div className="mt-8 space-y-6">
              {chat.map((m) => (
                <div key={m.id}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream-faint">
                    {m.role === "user" ? "You asked" : "Palmistica"}
                  </p>
                  {m.role === "user" ? (
                    <p className="rounded-xl border border-[rgba(243,238,228,0.12)] bg-[rgba(243,238,228,0.04)] px-4 py-3 text-sm text-cream">
                      {m.content}
                    </p>
                  ) : (
                    <div className="rounded-xl border border-[rgba(217,178,94,0.16)] bg-[rgba(23,19,31,0.6)] px-4 py-3">
                      <PalmMarkdown>{m.content}</PalmMarkdown>
                    </div>
                  )}
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
          )}

          {sending && (
            <p className="mt-6 animate-fade-up text-sm text-cream-faint">
              <span className="text-gold">✦</span> Palmistica is considering…
            </p>
          )}
          {chatError && (
            <p className="mt-4 text-sm text-[#f0c9c9]">{chatError}</p>
          )}

          {/* Composer */}
          {!readOnly && (
            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                sendQuestion(draft);
              }}
            >
              <div className="flex items-end gap-3 rounded-2xl border border-[rgba(217,178,94,0.22)] bg-[rgba(11,10,18,0.6)] p-2.5 focus-within:border-gold">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendQuestion(draft);
                    }
                  }}
                  rows={1}
                  placeholder="Ask about your palm…"
                  disabled={sending}
                  className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-cream placeholder:text-cream-faint focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="btn-gold !animate-none !px-5 !py-2.5 !text-xs disabled:opacity-40"
                >
                  Ask
                </button>
              </div>
            </form>
          )}

          {readOnly && (
            <div className="mt-12 rounded-2xl border border-[rgba(217,178,94,0.2)] bg-[rgba(61,31,79,0.25)] p-8 text-center">
              <h2 className="font-serif text-2xl text-cream">
                Your hands have their own story
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-cream-muted">
                Palmistica reads it in about a minute. No account needed.
              </p>
              <Link href="/read" className="btn-gold mt-6 inline-flex">
                Get your own reading
              </Link>
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="mt-14 flex flex-wrap items-center justify-center gap-3 border-t border-[rgba(217,178,94,0.14)] pt-6">
          <SharePanel shareUrl={shareUrl} size="sm" />
          <Link
            href="/read"
            className="btn-ghost !px-4 !py-1.5 text-[11px] uppercase tracking-[0.14em]"
          >
            Redo Palm Reading
          </Link>
        </div>
      )}

      <DeleteReadingControl shareId={shareId} onDeleted={() => router.replace("/")} />
    </div>
  );
}
