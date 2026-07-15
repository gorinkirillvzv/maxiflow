// About renderer — expert card on the public landing page.
// Server-safe (no hooks, no browser APIs). Rendered on /lp/[slug].
// Layout: photo on the left, text on the right on desktop; stacked on mobile.
// Photo is optional — when missing, initials fall back inside a soft circle so
// the card never renders an empty square.

import type { AboutData } from "@/lib/landing-blocks/types";

export interface AboutRendererProps {
  id: string;
  data: AboutData;
  /** Available for future funnel wiring. Unused here. */
  landingId?: string;
}

// Editor allows any number of badges, but the visual design caps at 4 — extras
// past that clutter the card without adding trust signal.
const MAX_BADGES = 4;

/**
 * Cheap initials fallback used when the tenant left `photoUrl` blank. Handles
 * "Ivan Petrov" -> "IP", single-word names -> first two letters, and empty
 * strings -> a neutral bullet so we never render an empty avatar.
 */
function initialsFrom(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "•";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export default function AboutRenderer({ id, data }: AboutRendererProps) {
  const hasPhoto = !!data.photoUrl?.trim();
  const badges = (data.badges ?? [])
    .map((b) => b?.trim())
    .filter((b): b is string => !!b)
    .slice(0, MAX_BADGES);
  const hasBadges = badges.length > 0;
  const initials = initialsFrom(data.name);

  return (
    <section
      id={`block-${id}`}
      className="lp-block about"
      data-block-type="about"
    >
      <div className="lp-container">
        <div className="lp-card about__card">
          <div className="about__media">
            {hasPhoto ? (
              // Plain <img> — landings often reference external URLs (S3, MAX
              // CDN, tenant hosts) where next/image would need whitelisting.
              <img
                className="about__photo"
                src={data.photoUrl}
                alt={data.name ? `Фото: ${data.name}` : ""}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="about__photo about__photo--placeholder" aria-hidden="true">
                <span className="about__initials">{initials}</span>
              </div>
            )}
          </div>

          <div className="about__body">
            {data.name ? <h2 className="lp-h2 about__name">{data.name}</h2> : null}
            {data.role ? <p className="about__role">{data.role}</p> : null}
            {data.bio ? (
              // Preserve author-authored line breaks — bios are short prose,
              // not markdown, so we just split on newlines.
              <div className="about__bio">
                {data.bio.split("\n").map((line, i) => (
                  <p key={i} className="lp-text about__bio-line">{line}</p>
                ))}
              </div>
            ) : null}

            {hasBadges ? (
              <ul className="about__badges" aria-label="Регалии">
                {badges.map((badge, i) => (
                  <li key={i} className="about__badge">{badge}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {/* Block-scoped CSS. Emitted per about instance; browsers dedupe identical
          rulesets so multiple about blocks on the same page don't cost anything. */}
      <style>{`
        .about__card {
          display: grid;
          gap: 20px;
          grid-template-columns: 1fr;
          align-items: start;
        }
        .about__media {
          display: flex;
          justify-content: center;
        }
        .about__photo {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          display: block;
          background: var(--lp-surface-2);
        }
        .about__photo--placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--brand-violet-soft);
          color: var(--brand-violet);
        }
        .about__initials {
          font-size: 40px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .about__name {
          margin: 0 0 4px;
        }
        .about__role {
          margin: 0 0 12px;
          color: var(--lp-muted);
          font-size: 15px;
          line-height: 1.4;
        }
        .about__bio {
          margin: 0 0 16px;
        }
        .about__bio-line {
          margin: 0 0 8px;
        }
        .about__bio-line:last-child {
          margin-bottom: 0;
        }
        .about__badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .about__badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--brand-violet-soft);
          color: var(--brand-violet);
          font-size: 13px;
          font-weight: 500;
          line-height: 1.2;
          border: 1px solid transparent;
        }

        @media (min-width: 560px) {
          .about__card {
            grid-template-columns: 140px 1fr;
            gap: 24px;
            align-items: center;
          }
          .about__media {
            justify-content: flex-start;
          }
          .about__photo {
            width: 140px;
            height: 140px;
          }
        }
      `}</style>
    </section>
  );
}
