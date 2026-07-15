// Public renderer for the "faq" block — a native <details>/<summary> accordion
// of question/answer pairs. Server-safe: no hooks, no client-only APIs.
// The accordion works without JavaScript — browsers handle the disclosure
// widget on their own, which keeps the page snappy on slow devices and
// leaves questions/answers visible to search engines.

import type { FaqData } from "@/lib/landing-blocks/types";

export interface FaqRendererProps {
  id: string;
  data: FaqData;
}

/**
 * Renders the section heading (when set), then a list of accordion rows.
 * Rows with an empty question are dropped — an empty <summary> would be
 * unclickable and semantically confusing.
 */
export default function FaqRenderer({ id, data }: FaqRendererProps) {
  const items = Array.isArray(data.items) ? data.items : [];
  const visible = items.filter((it) => it.question?.trim());

  // Nothing to show — hide entirely so an empty block doesn't leave awkward
  // whitespace between neighbours.
  if (visible.length === 0 && !data.title?.trim()) return null;

  return (
    <section
      id={`block-${id}`}
      className="lp-block"
      aria-labelledby={data.title ? `block-${id}-title` : undefined}
    >
      <div className="lp-container">
        {data.title?.trim() ? (
          <h2 id={`block-${id}-title`} className="lp-h2 lp-align-center lp-faq-title">
            {data.title}
          </h2>
        ) : null}

        {visible.length > 0 ? (
          <ul className="lp-faq-list" role="list">
            {visible.map((item) => (
              <li key={item.id} className="lp-faq-item">
                <details className="lp-faq-details">
                  <summary className="lp-faq-summary">
                    <span className="lp-faq-question">{item.question}</span>
                    <span className="lp-faq-chevron" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M3 5l4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </summary>
                  {item.answer?.trim() ? (
                    <div className="lp-faq-answer">
                      {/* Preserve author line breaks without needing markdown parsing. */}
                      {item.answer.split(/\n{2,}/).map((para, i) => (
                        <p key={i} className="lp-text lp-faq-p">
                          {para.split("\n").map((line, j, arr) => (
                            <span key={j}>
                              {line}
                              {j < arr.length - 1 ? <br /> : null}
                            </span>
                          ))}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Scoped styles: additive on top of lp.css primitives. */}
      <style>{`
        .lp-faq-title { margin-bottom: 24px; }
        .lp-faq-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lp-faq-item {
          background: var(--lp-surface);
          border: 1px solid var(--lp-line);
          border-radius: var(--lp-radius);
          overflow: hidden;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .lp-faq-item:hover {
          border-color: var(--lp-accent);
        }
        .lp-faq-details {
          width: 100%;
        }
        .lp-faq-summary {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          cursor: pointer;
          list-style: none;
          user-select: none;
          font-family: inherit;
        }
        .lp-faq-summary::-webkit-details-marker {
          display: none;
        }
        .lp-faq-summary::marker {
          display: none;
        }
        .lp-faq-question {
          flex: 1;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.4;
          color: var(--lp-fg);
        }
        .lp-faq-chevron {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: var(--brand-violet-soft);
          color: var(--lp-accent);
          margin-top: 1px;
          transition: transform 180ms ease;
        }
        .lp-faq-details[open] .lp-faq-chevron {
          transform: rotate(180deg);
        }
        .lp-faq-answer {
          padding: 0 18px 18px;
        }
        .lp-faq-p {
          margin: 0 0 10px;
          color: var(--lp-muted);
          font-size: 15px;
          line-height: 1.6;
        }
        .lp-faq-p:last-child {
          margin-bottom: 0;
        }

        @media (min-width: 640px) {
          .lp-faq-summary {
            padding: 18px 22px;
          }
          .lp-faq-answer {
            padding: 0 22px 20px;
          }
          .lp-faq-question {
            font-size: 17px;
          }
        }
      `}</style>
    </section>
  );
}
