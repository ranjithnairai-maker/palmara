export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10">
      <hr className="hairline mb-6" />
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="font-serif text-sm text-cream-muted">Palmara</p>
        <p className="max-w-md text-xs leading-relaxed text-cream-faint">
          Palmara offers reflective readings for curiosity and entertainment. It is
          not a source of medical, financial, or legal advice.
        </p>
      </div>
    </footer>
  );
}
