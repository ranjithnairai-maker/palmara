import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders trusted model markdown with Palmistica's prose styling. */
export function PalmMarkdown({ children }: { children: string }) {
  return (
    <div className="reading-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
