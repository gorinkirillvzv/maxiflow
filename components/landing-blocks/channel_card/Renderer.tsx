"use client";

// Public renderer for the "channel_card" block — «Подпишись на канал».
// Mobile-first card: title (h3) + small description + tall CTA button.
// Click flow:
//   1) Read MAX user id from the WebApp SDK (window.WebApp.initDataUnsafe.user.id).
//   2) POST /api/mini/subscribe { bot_id, max_user_id } — server-side adds the user
//      via MAX BotAPI so no channel jump is required.
//   3) On 2xx swap the button for a static «✓ Подписаны» state.
//      On 4xx surface a compact error message right under the button.
//
// This component is client-only because it depends on the MAX WebApp SDK
// and manages local button state.

import { useState } from "react";
import type { ChannelCardData } from "@/lib/landing-blocks/types";

/** Narrow shape of the MAX WebApp SDK we rely on here.
 *  Kept local so this file doesn't need the full app/m/[bot] declaration. */
type MaxWebApp = {
  initDataUnsafe?: {
    user?: { id?: number };
  };
  openMaxLink?: (url: string) => void;
};

export interface ChannelCardRendererProps {
  id: string;
  data: ChannelCardData;
  /** Owner bot uuid — needed by /api/mini/subscribe to look up the channel. */
  botId?: string;
  /** Reserved for future deeplink fallback if the bot can't add the user. */
  botUsername?: string;
  /** Reserved: some layouts might want to render the channel handle. */
  channelId?: string;
}

type ButtonState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/** Reads the current MAX user id from the WebApp SDK, if it's loaded.
 *  The Mini App shell (app/m/[bot]/page.tsx) is responsible for injecting it;
 *  outside of MAX (preview in the editor, direct link) this returns null and
 *  the button reports a friendly error instead of crashing. */
function readMaxUserId(): number | null {
  if (typeof window === "undefined") return null;
  const app = (window as unknown as { WebApp?: MaxWebApp }).WebApp;
  const raw = app?.initDataUnsafe?.user?.id;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

export default function ChannelCardRenderer({ id, data, botId }: ChannelCardRendererProps) {
  const [state, setState] = useState<ButtonState>({ kind: "idle" });

  const title = data.title?.trim() ?? "";
  const description = data.description?.trim() ?? "";
  const buttonText = data.buttonText?.trim() || "Подписаться";

  // Fully empty card contributes nothing — hide it so the Mini App doesn't
  // render a naked white box between other blocks.
  if (!title && !description && state.kind === "idle") return null;

  async function handleSubscribe() {
    if (state.kind === "loading" || state.kind === "done") return;

    if (!botId) {
      // botId is what the API keys off; without it we can't call anything useful.
      setState({ kind: "error", message: "Карточка не привязана к боту." });
      return;
    }

    const maxUserId = readMaxUserId();
    if (maxUserId == null) {
      setState({
        kind: "error",
        message: "Откройте эту страницу в приложении MAX, чтобы подписаться.",
      });
      return;
    }

    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/mini/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, max_user_id: maxUserId }),
      });
      // /api/mini/subscribe возвращает 200 с { added, error_code, channel_link } — надо
      // разобрать body, а не полагаться на r.ok. added=false = MAX отказал (privacy) — тогда
      // fallback: открываем канал в MAX, юзер подписывается сам.
      let body: { added?: boolean; error_code?: string | null; channel_link?: string | null; error?: string } = {};
      try { body = (await r.json()) as typeof body; } catch { /* non-JSON */ }
      if (r.ok && body.added === true) {
        setState({ kind: "done" });
        return;
      }
      if (r.ok && body.channel_link) {
        // Fallback: открываем канал в MAX. Не показываем "✓ Подписаны" —
        // юзер ещё не подписался, но SDK его туда доставит.
        const app = (window as unknown as { WebApp?: MaxWebApp }).WebApp;
        if (app?.openMaxLink) {
          app.openMaxLink(body.channel_link);
        } else {
          window.location.href = body.channel_link;
        }
        setState({ kind: "idle" });
        return;
      }
      const message = body.error?.trim()
        || (body.error_code ? `MAX отказал: ${body.error_code}` : "Не получилось подписать.");
      setState({ kind: "error", message });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Сеть недоступна.",
      });
    }
  }

  const isDone = state.kind === "done";
  const isLoading = state.kind === "loading";

  return (
    <section
      id={`block-${id}`}
      data-block="channel_card"
      className="kk-channel-card"
      aria-labelledby={title ? `block-${id}-title` : undefined}
    >
      <div className="kk-channel-card__inner">
        {title ? (
          <h3 id={`block-${id}-title`} className="kk-channel-card__title">
            {title}
          </h3>
        ) : null}
        {description ? (
          <p className="kk-channel-card__description">{description}</p>
        ) : null}

        <button
          type="button"
          className="kk-channel-card__button"
          data-state={isDone ? "done" : isLoading ? "loading" : "idle"}
          onClick={handleSubscribe}
          disabled={isDone || isLoading}
          aria-live="polite"
        >
          {isDone ? "✓ Подписаны" : isLoading ? "…" : buttonText}
        </button>

        {state.kind === "error" ? (
          <p className="kk-channel-card__error" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>

      {/* Scoped styles: mobile-first, one-column, tall tap targets.
          All colour tokens come from the design-system CSS vars so this card
          reads correctly in both light and dark shells. */}
      <style>{`
        .kk-channel-card {
          width: 100%;
          max-width: 100%;
          font-family: var(--font-onest, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          box-sizing: border-box;
          padding: 12px 0;
        }
        .kk-channel-card__inner {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          border-radius: 20px;
          background: var(--n-50, #f5f5f7);
          box-sizing: border-box;
        }
        .kk-channel-card__title {
          margin: 0;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 700;
          color: var(--n-900, #111);
        }
        .kk-channel-card__description {
          margin: 0;
          font-size: 14px;
          line-height: 1.45;
          color: var(--n-600, #555);
        }
        .kk-channel-card__button {
          margin-top: 4px;
          width: 100%;
          min-height: 52px;
          padding: 14px 20px;
          border: 0;
          border-radius: 14px;
          background: var(--brand-violet, #5B47FB);
          color: #fff;
          font: inherit;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: transform .06s ease, opacity .15s ease, background-color .15s ease;
        }
        .kk-channel-card__button:active:not(:disabled) {
          transform: scale(0.99);
        }
        .kk-channel-card__button:disabled {
          cursor: default;
        }
        .kk-channel-card__button[data-state="done"] {
          background: var(--n-200, #e4e4ea);
          color: var(--n-700, #333);
        }
        .kk-channel-card__button[data-state="loading"] {
          opacity: 0.75;
        }
        .kk-channel-card__error {
          margin: 0;
          padding: 0 4px;
          font-size: 13px;
          line-height: 1.4;
          color: var(--danger, #d64545);
        }
      `}</style>
    </section>
  );
}
