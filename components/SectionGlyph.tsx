type Kind = "vitality" | "love" | "mind" | "path";

const PATHS: Record<Kind, string> = {
  // Flame / pulse
  vitality:
    "M12 2 C9 6 7 9 7 12.5 C7 16.5 9.5 19 12 19 C14.5 19 17 16.5 17 12.5 C17 10.5 16 8.5 15 7 C15 9 13.8 10.3 12.6 10.8 C13.4 9 13 6.6 11.8 5 C11.6 7 10.6 8.3 9.6 9.3",
  // Heart-line swirl
  love: "M12 19 C4 13 3 8.5 6.2 6 C8.6 4.1 11 5.6 12 7.5 C13 5.6 15.4 4.1 17.8 6 C21 8.5 20 13 12 19 Z",
  // Starburst
  mind: "M12 2 L13.3 9 L21 12 L13.3 15 L12 22 L10.7 15 L3 12 L10.7 9 Z",
  // Compass / path mark
  path: "M12 3 L12 6 M12 18 L12 21 M3 12 L6 12 M18 12 L21 12 M12 8 A4 4 0 1 0 12.01 8 M12 12 L15 9",
};

const LABELS: Record<Kind, string> = {
  vitality: "Vitality glyph",
  love: "Love glyph",
  mind: "Mind glyph",
  path: "Path glyph",
};

export function SectionGlyph({ kind, className = "" }: { kind: Kind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label={LABELS[kind]}
    >
      <path
        d={PATHS[kind]}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
