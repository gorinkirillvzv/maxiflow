// Public renderer for the "quote" block — a customer testimonial with author.
// Server-safe: no hooks, no browser APIs. Uses the `.lp-*` primitives from
// app/lp/lp.css for container/typography, plus a scoped <style> for the
// quote-specific card + author row.
//
// Layout: a large stylised quote body (single quotation-mark decoration on the
// left, adaptive font size), followed by an author strip (avatar circle + name
// + subtitle). If any field is empty it collapses gracefully — no empty avatar
// circle, no dangling author line — so a lazy edit still looks intentional.

import type { QuoteData } from "@/lib/landing-blocks/types";

export interface QuoteRendererProps {
  id: string;
  data: QuoteData;
}

/** Cheap initials fallback for an empty avatar — first letter of each word. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function QuoteRenderer({ id, data }: QuoteRendererProps) {
  const text = data.text?.trim() ?? "";
  const authorName = data.authorName?.trim() ?? "";
  const authorTitle = data.authorTitle?.trim() ?? "";
  const avatarUrl = data.authorAvatarUrl?.trim() ?? "";

  // Nothing to show — hide the block entirely rather than leaving an empty
  // decorative card between neighbours.
  if (!text && !authorName && !authorTitle) return null;

  const initials = initialsFrom(authorName);
  const hasAuthorLine = authorName.length > 0 || authorTitle.length > 0;

  return (
    <section
      id={`block-${id}`}
      className="lp-block lp-block--quote"
      aria-label="Отзыв клиента"
    >
      <div className="lp-container">
        <figure className="lp-quote-card">
          {text ? (
            <blockquote className="lp-quote-body">
              <span className="lp-quote-mark" aria-hidden="true">
                &ldquo;
              </span>
              <p className="lp-quote-text">{text}</p>
            </blockquote>
          ) : null}

          {hasAuthorLine ? (
            <figcaption className="lp-quote-author">
              {avatarUrl ? (
                // Plain <img> on purpose — landings may pull avatars from any
                // domain, which next/image would need explicit config for.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="lp-quote-avatar"
                  src={avatarUrl}
                  alt={authorName ? `Фото: ${authorName}` : ""}
                  loading="lazy"
                  width={56}
                  height={56}
                />
              ) : initials ? (
                <span
                  className="lp-quote-avatar lp-quote-avatar--initials"
                  aria-hidden="true"
                >
                  {initials}
                </span>
              ) : null}

              <span className="lp-quote-author-lines">
                {authorName ? (
                  <span className="lp-quote-author-name">{authorName}</span>
                ) : null}
                {authorTitle ? (
                  <span className="lp-quote-author-title">{authorTitle}</span>
                ) : null}
              </span>
            </figcaption>
          ) : null}
        </figure>
      </div>

      {/* Scoped styles — additive on top of lp.css primitives so the block
          travels with its component. */}
      <style>{`
        .lp-block--quote .lp-quote-card {
          margin: 0;
          padding: 28px 24px 24px;
          background: var(--lp-surface-2);
          border-radius: var(--lp-radius-lg);
          position: relative;
        }
        .lp-block--quote .lp-quote-body {
          margin: 0 0 20px;
          position: relative;
          padding-left: 44px;
        }
        .lp-block--quote .lp-quote-mark {
          position: absolute;
          left: -2px;
          top: -14px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 72px;
          line-height: 1;
          color: var(--brand-violet);
          opacity: 0.5;
          user-select: none;
          pointer-events: none;
        }
        .lp-block--quote .lp-quote-text {
          margin: 0;
          font-size: clamp(18px, 2.6vw, 22px);
          line-height: 1.5;
          font-weight: 500;
          color: var(--lp-fg);
          white-space: pre-wrap;
        }
        .lp-block--quote .lp-quote-author {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-left: 44px;
        }
        .lp-block--quote .lp-quote-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          background: var(--brand-violet-soft);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .lp-block--quote .lp-quote-avatar--initials {
          color: var(--brand-violet);
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 0.02em;
        }
        .lp-block--quote .lp-quote-author-lines {
          display: inline-flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .lp-block--quote .lp-quote-author-name {
          font-weight: 600;
          font-size: 15px;
          color: var(--lp-fg);
        }
        .lp-block--quote .lp-quote-author-title {
          font-size: 14px;
          color: var(--lp-muted);
        }
        @media (max-width: 480px) {
          .lp-block--quote .lp-quote-card {
            padding: 24px 18px 18px;
          }
          .lp-block--quote .lp-quote-body {
            padding-left: 32px;
          }
          .lp-block--quote .lp-quote-mark {
            font-size: 56px;
            top: -10px;
          }
          .lp-block--quote .lp-quote-author {
            padding-left: 32px;
          }
        }
      `}</style>
    </section>
  );
}
