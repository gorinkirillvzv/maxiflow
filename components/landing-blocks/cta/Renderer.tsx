// CTA renderer — repeat call-to-action banner shown mid- or end-page.
// Server-safe (no hooks, no browser APIs). Rendered on /lp/[slug].
// Layout: centred single-column block. When the theme paints a background
// (dark / violet) the section bleeds to the page edges via `lp-block--bleed`.

import type { CSSProperties } from "react";
import type { AccentTheme, CtaData } from "@/lib/landing-blocks/types";

export interface CtaRendererProps {
  id: string;
  data: CtaData;
  /** Available for future funnel wiring (goals, form target). Unused here. */
  landingId?: string;
}

// Fallback text if the tenant left the CTA blank.
const CTA_FALLBACK = "Оставить заявку";

// Anchor used when the CTA is bound to the landing's own bot funnel — the page
// is expected to render a lead form (or an anchor with id="lead") elsewhere.
const LEAD_ANCHOR = "#lead";

/**
 * Resolves the destination href for the CTA button. `bot` routes to a local
 * anchor because the funnel form lives on the same page; external destinations
 * fall back to the lead anchor when their URL is empty so the button is never
 * a dead link.
 */
function resolveCtaHref(cta: CtaData["cta"]): string {
  if (cta.destinationType === "bot") return LEAD_ANCHOR;
  const url = cta.url?.trim();
  return url ? url : LEAD_ANCHOR;
}

/**
 * Theme-driven CSS variable overrides. We rebind `--lp-*` on the section so
 * the shared `.lp-btn` / `.lp-h2` primitives automatically pick up the right
 * colours without per-theme selectors.
 */
function themeStyle(theme: AccentTheme): CSSProperties {
  switch (theme) {
    case "dark":
      return {
        background: "var(--ink)",
        "--lp-fg": "#ffffff",
        "--lp-muted": "rgba(255, 255, 255, 0.72)",
      } as CSSProperties;
    case "violet":
      return {
        background: "var(--brand-violet)",
        "--lp-fg": "#ffffff",
        "--lp-muted": "rgba(255, 255, 255, 0.85)",
        // Invert the CTA on violet — white pill with violet text reads best.
        "--lp-accent": "#ffffff",
        "--lp-accent-fg": "var(--brand-violet)",
        "--lp-accent-hover": "#f4f2ff",
      } as CSSProperties;
    case "light":
    default:
      // Soft surface so the CTA still visually separates from body copy.
      return {
        background: "var(--lp-surface-2)",
      };
  }
}

export default function CtaRenderer({ id, data }: CtaRendererProps) {
  // Bleed to page edges when the theme paints a solid background — otherwise
  // the block would just be a floating band with no visual weight.
  const isBleed = data.theme !== "light";
  const ctaText = data.cta.text?.trim() || CTA_FALLBACK;
  const href = resolveCtaHref(data.cta);
  // External links open in a new tab; local anchors stay in-page.
  const isExternal = /^https?:\/\//i.test(href);

  return (
    <section
      id={`block-${id}`}
      className={`lp-block cta${isBleed ? " lp-block--bleed cta--bleed" : " cta--soft"} cta--${data.theme}`}
      style={themeStyle(data.theme)}
      data-block-type="cta"
    >
      <div className="lp-container cta__inner">
        {data.title ? <h2 className="lp-h2 cta__title">{data.title}</h2> : null}
        {data.subtitle ? <p className="lp-lead cta__subtitle">{data.subtitle}</p> : null}
        <div className="cta__row">
          <a
            className="lp-btn lp-btn--lg cta__btn"
            href={href}
            {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            {...(data.cta.goalName ? { "data-goal": data.cta.goalName } : {})}
          >
            {ctaText}
          </a>
        </div>
      </div>

      {/* Block-scoped CSS. Emitted per CTA instance; browsers dedupe identical
          rulesets so multiple CTA blocks on the same page don't cost anything. */}
      <style>{`
        .cta__inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
          max-width: 640px;
        }
        .cta__title { margin: 0; }
        .cta__subtitle { margin: 0; }
        .cta__row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: center;
          margin-top: 8px;
        }
        /* Light theme still gets rounded corners so the soft surface looks
           like a card rather than a raw band. */
        .cta--soft {
          border-radius: var(--lp-radius-lg);
          padding: 40px 24px;
        }
        @media (min-width: 640px) {
          .cta--soft { padding: 48px 32px; }
        }
      `}</style>
    </section>
  );
}
