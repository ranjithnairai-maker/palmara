type Kind = "whatsapp" | "facebook" | "linkedin" | "reddit" | "instagram" | "copy" | "share";

// Simple line-art marks in the app's own visual language (see
// SectionGlyph.tsx) rather than literal brand logos — evocative of each
// platform without pasting in trademarked icon art, so the panel still
// reads as part of Palmistica rather than a generic share widget.
const PATHS: Record<Kind, string> = {
  whatsapp:
    "M12 3 C7 3 3.3 6.6 3.3 11 C3.3 12.7 3.8 14.3 4.7 15.6 L3.5 20 L8.1 18.8 C9.3 19.5 10.6 19.9 12 19.9 C17 19.9 20.7 16.3 20.7 11.9 C20.7 6.6 17 3 12 3 Z M9 8.6 C9.3 8.6 9.6 8.6 9.8 9.1 C10 9.5 10.5 10.7 10.5 10.9 C10.6 11 10.6 11.2 10.5 11.4 C10.3 11.7 10.1 11.9 9.9 12.1 C9.7 12.3 9.6 12.5 9.8 12.8 C10.1 13.3 10.8 14.3 11.7 15 C12.7 15.8 13.5 16.1 13.8 16.2 C14.1 16.3 14.3 16.3 14.5 16.1 C14.7 15.8 15.1 15.3 15.3 15 C15.5 14.8 15.7 14.8 15.9 14.9 C16.2 15 17.4 15.6 17.7 15.8 C18 15.9 18.1 16 18.2 16.1 C18.2 16.3 18.2 16.9 17.9 17.5 C17.6 18.1 16.5 18.7 16 18.7 C15.5 18.8 15 18.9 12.8 18 C10.1 16.9 8.4 14.2 8.2 14 C8.1 13.7 7.3 12.6 7.3 11.4 C7.3 10.2 7.9 9.7 8.1 9.4 C8.4 9.1 8.6 9 8.8 9 C8.9 8.6 9 8.6 9 8.6 Z",
  facebook:
    "M15 4 H13 C11.3 4 10 5.3 10 7 V9.5 H8 V12.5 H10 V20 H13 V12.5 H15.2 L15.5 9.5 H13 V7.3 C13 6.9 13.3 6.6 13.7 6.6 H15.5 V4 Z",
  linkedin:
    "M4.5 8.5 H7.5 V20 H4.5 Z M6 3.5 C7 3.5 7.8 4.3 7.8 5.3 C7.8 6.2 7 7 6 7 C5 7 4.2 6.2 4.2 5.3 C4.2 4.3 5 3.5 6 3.5 Z M10.5 8.5 H13.4 V10 C13.9 9.1 15 8.2 16.7 8.2 C19.5 8.2 20.5 10 20.5 13 V20 H17.5 V13.6 C17.5 12.2 17 11.1 15.6 11.1 C14.5 11.1 13.9 11.9 13.6 12.6 C13.5 12.9 13.5 13.3 13.5 13.7 V20 H10.5 Z",
  reddit:
    "M12 3.5 L12.9 7.2 M12.9 7.2 A2 2 0 1 1 12.9 7.21 M12.9 7.2 C15.5 7.4 17.5 8.7 18.3 10.4 A2 2 0 1 1 17.2 12.5 C15.9 11.6 14.1 11 12 11 C9.9 11 8.1 11.6 6.8 12.5 A2 2 0 1 1 5.7 10.4 C6.5 8.7 8.5 7.4 11.1 7.2 M4.5 13.5 C4.5 16.8 7.9 19.5 12 19.5 C16.1 19.5 19.5 16.8 19.5 13.5 M9 15.2 C9.5 15.7 10.6 16 12 16 C13.4 16 14.5 15.7 15 15.2 M9 13.8 A0.9 0.9 0 1 0 9.01 13.8 M15 13.8 A0.9 0.9 0 1 0 15.01 13.8",
  instagram:
    "M7.5 3.5 H16.5 A4 4 0 0 1 20.5 7.5 V16.5 A4 4 0 0 1 16.5 20.5 H7.5 A4 4 0 0 1 3.5 16.5 V7.5 A4 4 0 0 1 7.5 3.5 Z M12 8.3 A3.7 3.7 0 1 0 12.01 8.3 Z M16.6 6.5 A0.6 0.6 0 1 0 16.61 6.5",
  copy: "M8 8 H16.5 A1.5 1.5 0 0 1 18 9.5 V18 A1.5 1.5 0 0 1 16.5 19.5 H8 A1.5 1.5 0 0 1 6.5 18 V9.5 A1.5 1.5 0 0 1 8 8 Z M9.5 8 V6 A1.5 1.5 0 0 1 11 4.5 H16 A1.5 1.5 0 0 1 17.5 6 V14 A1.5 1.5 0 0 1 16 15.5 H14.5",
  share:
    "M17.5 8.5 A2.2 2.2 0 1 0 17.49 8.5 Z M6.5 14.2 A2.2 2.2 0 1 0 6.49 14.2 Z M17.5 19.9 A2.2 2.2 0 1 0 17.49 19.9 Z M8.4 13 L15.6 9.6 M8.4 15.3 L15.6 18.7",
};

const LABELS: Record<Kind, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  instagram: "Instagram",
  copy: "Copy link",
  share: "Share",
};

export function ShareGlyph({ kind, className = "" }: { kind: Kind; className?: string }) {
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
