// Public renderer for the "features" block — a checkmarked list of 3-6 benefits.
// Server-safe: no hooks, no browser APIs. Styling relies on the `.lp-*` primitives
// from app/lp/lp.css (container, grid, typography, card surface).

import type { FeaturesData } from "@/lib/landing-blocks/types";

export interface FeaturesRendererProps {
  id: string;
  data: FeaturesData;
}

/**
 * Renders the section heading (when set), then the list of items.
 * `columns` is clamped to the {1|2|3} palette the CSS knows about; anything
 * outside collapses to a single column so bad DB values can't blow the layout.
 */
export default function FeaturesRenderer({ id, data }: FeaturesRendererProps) {
  const columns = data.columns === 2 || data.columns === 3 ? data.columns : 1;
  const items = Array.isArray(data.items) ? data.items : [];

  // Nothing to show — hide entirely so an empty block doesn't leave awkward
  // whitespace between neighbours.
  if (items.length === 0 && !data.title?.trim()) return null;

  return (
    <section
      id={`block-${id}`}
      className="lp-block"
      aria-labelledby={data.title ? `block-${id}-title` : undefined}
    >
      <div className="lp-container">
        {data.title?.trim() ? (
          <h2 id={`block-${id}-title`} className="lp-h2 lp-align-center lp-features-title">
            {data.title}
          </h2>
        ) : null}

        <ul className={`lp-grid lp-grid--${columns} lp-features-list`} role="list">
          {items.map((item) => {
            const icon = item.icon?.trim() || "✓";
            return (
              <li key={item.id} className="lp-features-item">
                <span className="lp-features-icon" aria-hidden="true">
                  {icon}
                </span>
                <div className="lp-features-body">
                  {item.title?.trim() ? (
                    <h3 className="lp-h3 lp-features-item-title">{item.title}</h3>
                  ) : null}
                  {item.description?.trim() ? (
                    <p className="lp-text lp-muted lp-features-item-desc">{item.description}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Scoped styles: additive on top of lp.css primitives. Kept inline so
          the block travels with its component and needs no global CSS edit. */}
      <style>{`
        .lp-features-title { margin-bottom: 24px; }
        .lp-features-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .lp-features-item {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 12px;
          align-items: start;
          padding: 4px 0;
        }
        .lp-features-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: var(--brand-violet-soft);
          color: var(--lp-accent);
          font-size: 15px;
          font-weight: 700;
          line-height: 1;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .lp-features-item-title {
          margin: 0 0 4px;
        }
        .lp-features-item-desc {
          margin: 0;
          font-size: 15px;
        }
      `}</style>
    </section>
  );
}
