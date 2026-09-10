"use client";

import { useEffect, useState } from "react";
import { PalmGlyph } from "./PalmGlyph";

const PHRASES = [
  "Reading the light on your palm…",
  "Following the Life Line around the mount…",
  "Measuring the reach of your Head Line…",
  "Listening to the Heart Line…",
  "Looking for the Fate Line…",
  "Letting the lines settle into meaning…",
];

export function MysticLoader({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid h-56 w-56 place-items-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(217,178,94,0.16),transparent_70%)] blur-xl animate-candle"
        />
        <div
          aria-hidden
          className="absolute inset-2 rounded-full border border-[rgba(217,178,94,0.25)] [animation:var(--animate-spin-slow)]"
          style={{ borderTopColor: "rgba(241,209,145,0.8)" }}
        />
        <PalmGlyph className="relative h-44 w-44" trace />
      </div>
      <p
        key={i}
        className="mt-8 min-h-[1.5rem] animate-fade-up font-serif text-lg text-cream"
      >
        {label ?? PHRASES[i]}
      </p>
      <p className="mt-2 text-xs tracking-wide text-cream-faint">
        This can take up to a minute on the free model.
      </p>
    </div>
  );
}
