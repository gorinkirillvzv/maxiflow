// Hero renderer — first-screen block on the public landing page.
// Server-safe (no hooks, no browser APIs). Rendered on /lp/[slug].
// Layout: 1.2fr / 1fr grid on desktop when an image is present, single column
// on mobile with the image stacked above the text.

import type { CSSProperties } from "react";
import type { AccentTheme, HeroData } from "@/lib/landing-blocks/types";

export interface HeroRendererProps {
  id: string;
  data: HeroData;
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
function resolveCtaHref(cta: HeroData["cta"]): string {
  if (cta.destinationType === "bot") return LEAD_ANCHOR;
  const url = cta.url?.trim();
  return url ? url : LEAD_ANCHOR;
}

/**
 * Theme-driven CSS variable overrides. We rebind `--lp-*` on the section so
 * the shared `.lp-btn` / `.lp-h1` primitives automatically pick up the right
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
      return {};
  }
}

function alignClass(align: HeroData["align"]): string {
  if (align === "center") return "lp-align-center";
  if (align === "right") return "lp-align-right";
  return "lp-align-left";
}

export default function HeroRenderer({ id, data }: HeroRendererProps) {
  const hasImage = !!data.imageUrl?.trim();
  // Only bleed the block to the page edges when the theme paints a background —
  // otherwise it just adds a white band that doesn't do anything visually.
  const isBleed = data.theme !== "light";
  const ctaText = data.cta.text?.trim() || CTA_FALLBACK;
  const href = resolveCtaHref(data.cta);
  // External links open in a new tab; local anchors stay in-page.
  const isExternal = /^https?:\/\//i.test(href);

  return (
    <section
      id={`block-${id}`}
      className={`lp-block hero${isBleed ? " lp-block--bleed hero--bleed" : ""} hero--${data.theme}${hasImage ? " hero--with-image" : " hero--text-only"}`}
      style={themeStyle(data.theme)}
      data-block-type="hero"
    >
      <div className="lp-container hero__inner">
        <div className={`hero__text ${alignClass(data.align)}`}>
          {data.title ? <h1 className="lp-h1 hero__title">{data.title}</h1> : null}
          {data.subtitle ? <p className="lp-lead hero__subtitle">{data.subtitle}</p> : null}
          <div className="hero__cta-row">
            <a
              className="lp-btn lp-btn--lg hero__cta"
              href={href}
              {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              {...(data.cta.goalName ? { "data-goal": data.cta.goalName } : {})}
            >
              {ctaText}
            </a>
          </div>
        </div>

        {hasImage ? (
          <div className="hero__media">
            {/* Plain <img> — landings often reference external URLs (S3, MAX CDN,
                random tenant hosts) where next/image would need whitelisting. */}
            <img
              className="lp-media hero__image"
              src={data.imageUrl}
              alt={data.imageAlt || ""}
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}
      </div>

      {/* Block-scoped CSS. Emitted per hero instance; browsers dedupe identical
          rulesets so multiple hero blocks on the same page don't cost anything. */}
      <style>{`
        .hero__inner {
          display: grid;
          gap: 24px;
          grid-template-columns: 1fr;
          align-items: center;
        }
        .hero__title { margin-bottom: 12px; }
        .hero__subtitle { margin-bottom: 24px; }
        .hero__cta-row { display: flex; flex-wrap: wrap; gap: 12px; }
        .hero--dark .lp-align-center .hero__cta-row,
        .hero--violet .lp-align-center .hero__cta-row,
        .lp-align-center .hero__cta-row { justify-content: center; }
        .lp-align-right .hero__cta-row { justify-content: flex-end; }

        .hero__media {
          /* On mobile the image sits above the text — feels more like an app
             hero than a text wall. */
          order: -1;
        }
        .hero__image {
          aspect-ratio: 4 / 3;
          object-fit: cover;
        }

        @media (min-width: 720px) {
          .hero--with-image .hero__inner {
            grid-template-columns: 1.2fr 1fr;
            gap: 40px;
          }
          .hero--with-image .hero__media { order: 0; }
          .hero--with-image .hero__image {
            aspect-ratio: 1 / 1;
          }
        }
      `}</style>
    </section>
  );
}
