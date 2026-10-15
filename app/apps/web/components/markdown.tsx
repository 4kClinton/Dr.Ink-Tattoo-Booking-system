import { Fragment, type ReactNode } from "react";

/**
 * Tiny, safe markdown for T&Cs: #/##/### headings, paragraphs, - lists, **bold**, _italic_.
 * Builds React elements — never injects HTML.
 */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <strong key={i++}>{t.slice(2, -2)}</strong> : <em key={i++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  // a heading line always starts its own block
  const blocks = source
    .replace(/\r\n/g, "\n")
    .replace(/^(#{1,3}\s.*)$/gm, "\n$1\n")
    .split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        const h = lines[0]!.match(/^(#{1,3})\s+(.*)$/);
        if (h && lines.length === 1) {
          const level = h[1]!.length;
          const cls = level === 1 ? "mt-2 mb-4 text-heading font-semibold" : "mt-6 mb-2 text-subhead font-semibold";
          return level === 1 ? (
            <h2 key={bi} className={cls}>{inline(h[2]!)}</h2>
          ) : (
            <h3 key={bi} className={cls}>{inline(h[2]!)}</h3>
          );
        }
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={bi} className="mb-4 list-disc pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="mb-4">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
