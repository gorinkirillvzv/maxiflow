// Public renderer for the "footer" block.
// Server-safe (no client hooks) — rendered inside /l/[slug] and preview.
//
// Design: dark ink background with muted-2 text, small font. Two vertical
// columns of info (contacts / legal) stack on mobile, sit side-by-side on
// desktop. Nothing here is interactive except the optional policy link and
// mailto/tel anchors, which we build defensively so bad user input never
// breaks the page.

import type { FooterData } from "@/lib/landing-blocks/types";

export interface FooterRendererProps {
  id: string;
  data: FooterData;
}

/** Strip whitespace and return null when the field is effectively empty. */
function trimOrNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.trim();
  return v ? v : null;
}

/** Normalise a phone value into a `tel:` href — keeps + and digits only. */
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

/**
 * Accept only http(s) URLs for the policy link — anything else (relative,
 * javascript:, empty) is rejected so we don't ship dangerous hrefs.
 */
function safeUrl(url: string): string | null {
  const v = trimOrNull(url);
  if (!v) return null;
  try {
    const parsed = new URL(v);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // ignore — user typed something that isn't a URL yet
  }
  return null;
}

export default function FooterRenderer({ id, data }: FooterRendererProps) {
  const legalName = trimOrNull(data.legalName);
  const legalId = trimOrNull(data.legalId);
  const email = trimOrNull(data.email);
  const phone = trimOrNull(data.phone);
  const disclaimer = trimOrNull(data.disclaimer);
  const policyHref = safeUrl(data.policyUrl);
  const policyLabel = trimOrNull(data.policyLabel) ?? "Политика конфиденциальности";
  const year = new Date().getFullYear();

  return (
    <footer
      id={`block-${id}`}
      className="lp-block lp-block--bleed lp-footer"
      aria-label="Юридическая информация"
    >
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div className="lp-footer__col">
            <div className="lp-footer__title">Контакты</div>
            {phone ? (
              <div className="lp-footer__row">
                <a className="lp-footer__link" href={telHref(phone)}>
                  {phone}
                </a>
              </div>
            ) : null}
            {email ? (
              <div className="lp-footer__row">
                <a className="lp-footer__link" href={`mailto:${email}`}>
                  {email}
                </a>
              </div>
            ) : null}
          </div>

          <div className="lp-footer__col">
            <div className="lp-footer__title">Юридическая информация</div>
            {legalName ? <div className="lp-footer__row">{legalName}</div> : null}
            {legalId ? <div className="lp-footer__row">{legalId}</div> : null}
            {policyHref ? (
              <div className="lp-footer__row">
                <a
                  className="lp-footer__link"
                  href={policyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {policyLabel}
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {disclaimer ? (
          <p className="lp-footer__disclaimer">{disclaimer}</p>
        ) : null}

        <div className="lp-footer__copy">
          {legalName ? `© ${year} ${legalName}` : `© ${year}`}
        </div>
      </div>

      {/*
        Scoped styles for this block. We use inline <style> instead of adding
        rules to lp.css so each block file stays self-contained (per the
        block-system convention noted in lp.css). Emits once per footer
        instance — fine because there's usually a single footer per page.
      */}
      <style>{`
        .lp-footer {
          background: #15141C;
          color: #9ca3af;
          padding: 40px 20px 32px;
          margin-top: 64px;
          font-size: 13px;
          line-height: 1.55;
        }
        .lp-footer__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 640px) {
          .lp-footer__grid {
            grid-template-columns: 1fr 1fr;
            gap: 32px;
          }
        }
        .lp-footer__col {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .lp-footer__title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .lp-footer__row {
          font-size: 13px;
          color: #cfd2d9;
        }
        .lp-footer__link {
          color: #cfd2d9;
          text-decoration: none;
          border-bottom: 1px solid rgba(207, 210, 217, 0.25);
          transition: color 120ms ease, border-color 120ms ease;
        }
        .lp-footer__link:hover {
          color: #ffffff;
          border-bottom-color: rgba(255, 255, 255, 0.6);
        }
        .lp-footer__disclaimer {
          margin: 24px 0 0;
          font-size: 12px;
          line-height: 1.5;
          color: #6b7280;
          max-width: 640px;
        }
        .lp-footer__copy {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
    </footer>
  );
}
