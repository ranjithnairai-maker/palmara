type PalmGlyphProps = {
  className?: string;
  /** When true, the four major lines draw themselves on in sequence, looping. */
  trace?: boolean;
};

// Open right hand, palm facing out, fingers up. One continuous outline.
const HAND_OUTLINE =
  "M88 264 C 80 232, 74 214, 73 196 C 66 200, 56 210, 48 208 C 41 206, 41 196, 47 186 C 54 174, 66 168, 78 164 C 78 150, 78 150, 78 146 " +
  "L78 78 C 78 70, 84 66, 90 66 C 96 66, 100 70, 100 78 L100 144 " +
  "L104 144 L104 62 C 104 54, 110 50, 116 50 C 122 50, 126 54, 126 62 L126 146 " +
  "L130 146 L130 70 C 130 62, 136 58, 142 58 C 148 58, 152 62, 152 70 L152 150 " +
  "L156 150 L156 98 C 156 90, 161 86, 167 86 C 173 86, 177 90, 177 98 L177 168 " +
  "C 178 196, 176 224, 166 258 C 164 264, 162 268, 160 272 L92 272 Z";

const LINES: { d: string; delay: number; label: string }[] = [
  // Heart line — just below the finger bases, sweeping across
  { d: "M170 150 C 140 132, 100 130, 74 150", delay: 0, label: "heart" },
  // Head line — across the mid palm
  { d: "M72 176 C 104 196, 138 198, 172 186", delay: 0.9, label: "head" },
  // Life line — arc around the thumb mound
  { d: "M80 152 C 66 178, 70 220, 100 258", delay: 1.8, label: "life" },
  // Fate line — rising up the centre
  { d: "M120 256 C 120 220, 120 190, 124 158", delay: 2.7, label: "fate" },
];

export function PalmGlyph({ className = "", trace = false }: PalmGlyphProps) {
  return (
    <svg
      viewBox="0 0 240 320"
      fill="none"
      className={className}
      role="img"
      aria-label="An open palm traced with its major lines"
    >
      <defs>
        <linearGradient id="palm-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1d191" stopOpacity="0.7" />
          <stop offset="1" stopColor="#d9b25e" stopOpacity="0.25" />
        </linearGradient>
        <radialGradient id="palm-fill" cx="0.5" cy="0.55" r="0.62">
          <stop offset="0" stopColor="#3d1f4f" stopOpacity="0.5" />
          <stop offset="1" stopColor="#3d1f4f" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        d={HAND_OUTLINE}
        fill="url(#palm-fill)"
        stroke="url(#palm-edge)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <g
        stroke="#f1d191"
        strokeWidth="2"
        strokeLinecap="round"
        style={
          trace
            ? { filter: "drop-shadow(0 0 6px rgba(217,178,94,0.55))" }
            : undefined
        }
      >
        {LINES.map((line) => (
          <path
            key={line.label}
            d={line.d}
            pathLength={1}
            strokeDasharray={trace ? 1 : undefined}
            style={
              trace
                ? {
                    animation: `trace-line 2.1s var(--ease-mystic) ${line.delay}s infinite alternate, trace-glow 4.2s ease-in-out ${line.delay}s infinite`,
                  }
                : { opacity: 0.72 }
            }
          />
        ))}
      </g>
    </svg>
  );
}
