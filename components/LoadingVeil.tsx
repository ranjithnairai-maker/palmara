import { PalmGlyph } from "./PalmGlyph";

/** Lightweight full-height loader for route transitions. */
export function LoadingVeil({ message = "Turning your hand to the light…" }: { message?: string }) {
  return (
    <div className="relative z-10 flex min-h-[70vh] flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="relative grid h-40 w-40 place-items-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(217,178,94,0.16),transparent_70%)] blur-xl animate-candle"
        />
        <PalmGlyph className="relative h-32 w-32" trace />
      </div>
      <p className="mt-6 font-serif text-lg text-cream">{message}</p>
    </div>
  );
}
