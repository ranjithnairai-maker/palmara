const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10">
      <hr className="hairline mb-6" />
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="font-serif text-sm text-cream-muted">Palmistica</p>
        <p className="max-w-md text-xs leading-relaxed text-cream-faint">
          Palmistica offers reflective readings for curiosity and entertainment. It is
          not a source of medical, financial, or legal advice.
        </p>
      </div>
      {CONTACT_EMAIL && (
        <p className="mt-4 text-center text-[11px] text-cream-faint sm:text-left">
          Lost the browser that created a reading and need it removed?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline decoration-[rgba(217,178,94,0.4)] underline-offset-2 hover:text-gold"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      )}
    </footer>
  );
}
