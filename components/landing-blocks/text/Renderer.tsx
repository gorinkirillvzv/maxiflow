// Server-safe renderer for the `text` block on public landing pages (/l/[slug]).
//
// Storage format is the same MAX-markdown subset used everywhere in Maxiflow so
// the same source paste-cycles cleanly between MAX posts, notifications and
// landings: **bold**, _italic_, ++underline++, ~~strike~~, `code`, [text](url),
// list rows (`- `, `* `, `• `). Blank lines split paragraphs; single newlines
// become <br> within a paragraph.
//
// We escape everything first, then re-introduce the whitelist of markdown-derived
// tags via server-side string building. That keeps the whole path server-safe
// (no dangerouslySetInnerHTML risk from user content because raw HTML never
// survives the escape step).
//
// The renderer is intentionally a plain server component so text blocks are in
// the initial HTML — critical for SEO and for landings loading on flaky mobile
// networks.

import type { TextData } from "@/lib/landing-blocks/types";

export interface TextRendererProps {
  /** Block id (unused for text — kept for BlockRenderer prop parity). */
  id?: string;
  data: TextData;
}

// ---------------------------------------------------------------------------
// Sanitisation helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Only allow protocols we consider safe on a public landing. Anything else
 * (javascript:, data:, vbscript:) gets stripped — the link renders as plain
 * text instead of an anchor.
 */
function isSafeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("mailto:") ||
    u.startsWith("tel:") ||
    u.startsWith("/") ||
    u.startsWith("#")
  );
}

// ---------------------------------------------------------------------------
// Markdown → HTML (whitelist, server-side)
// ---------------------------------------------------------------------------

function renderInline(src: string): string {
  // First escape everything, then re-introduce the whitelist of tags via
  // regex. The order matters: links go first so their URL bracket doesn't
  // trip the bold/italic patterns, then bold before italic (to avoid `**` being
  // eaten by the underscore-italic pattern), then the decorators.
  let s = escapeHtml(src);

  // [text](url) — bracket link. url must not contain whitespace or `)`.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    // escapeHtml turned `&` in the URL into `&amp;`; restore for the safety
    // check, then re-escape when we build the attribute.
    const raw = url.replace(/&amp;/g, "&");
    if (!isSafeUrl(raw)) return text;
    return `<a href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  // **bold**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  // ++underline++
  s = s.replace(/\+\+([^+\n]+)\+\+/g, "<u>$1</u>");
  // ~~strike~~
  s = s.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  // _italic_ — outside boundary must not be a word char so snake_case stays intact.
  s = s.replace(/(^|[^\w<])_([^_\n<]+)_(?=$|[^\w>])/g, "$1<i>$2</i>");
  // `code`
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  return s;
}

function markdownToHtml(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let inList = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p class="lp-text">${paragraph.join("<br>")}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (inList) {
      out.push(
        `<ul class="lp-text-list">${listItems.map((li) => `<li>${li}</li>`).join("")}</ul>`,
      );
      listItems = [];
      inList = false;
    }
  };

  for (const line of lines) {
    // List row: `- item`, `* item`, `+ item`, or bullet `• item` (leading spaces allowed).
    const listMatch = /^\s*(?:[-*+•])\s+(.+)$/.exec(line);
    if (listMatch) {
      flushParagraph();
      inList = true;
      listItems.push(renderInline(listMatch[1]));
      continue;
    }
    if (line.trim() === "") {
      // Blank row ends the current paragraph / list.
      flushParagraph();
      flushList();
      continue;
    }
    // Non-empty prose row: close any open list, append to current paragraph.
    flushList();
    paragraph.push(renderInline(line));
  }
  flushParagraph();
  flushList();
  return out.join("");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TextRenderer({ data }: TextRendererProps) {
  const html = markdownToHtml(data.markdown ?? "");
  const align =
    data.align === "center"
      ? "lp-align-center"
      : data.align === "right"
        ? "lp-align-right"
        : "lp-align-left";

  // Nothing to show — skip the wrapper entirely so an empty block collapses
  // instead of leaving a mysterious gap in the page.
  if (!html) return null;

  return (
    <section className="lp-block lp-block--text">
      <div className="lp-container">
        <div
          className={`lp-text-body ${align}`}
          // Content is fully sanitised above: escapeHtml runs first, then only
          // a whitelist of tags is re-introduced. Safe against injection.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      <style>{`
        .lp-block--text .lp-text-body { color: var(--lp-fg); }
        .lp-block--text .lp-text-body p.lp-text:last-child { margin-bottom: 0; }
        .lp-block--text .lp-text-list {
          margin: 0 0 16px;
          padding-left: 22px;
          color: var(--lp-fg);
          font-size: 16px;
          line-height: 1.6;
        }
        .lp-block--text .lp-text-list li { margin: 6px 0; }
        .lp-block--text .lp-text-list li::marker { color: var(--lp-accent); }
        .lp-block--text .lp-text-body a {
          color: var(--lp-accent);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .lp-block--text .lp-text-body code {
          padding: 2px 6px;
          border-radius: 6px;
          background: var(--lp-surface-2);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.92em;
        }
      `}</style>
    </section>
  );
}
