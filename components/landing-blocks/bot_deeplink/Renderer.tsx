"use client";

// Public renderer for the "bot_deeplink" block — карточка «открыть бота».
// Ведёт на https://max.ru/<bot_username>?start=<startCommand>.
// В MAX Mini App используем WebApp.openMaxLink (он умеет открывать чат-ссылки
// внутри клиента без выхода в браузер). Вне MAX (обычный лендинг в вебе)
// fallback — window.location.href, чтобы deeplink всё равно сработал.
//
// helper `id` держим для симметрии с остальными renderer'ами (BlockRenderer
// прокидывает block.id), `botUsername` — единственный кусок контекста, который
// нужен именно этому блоку (name бота, к которому клеим ?start=...).

import { useCallback, useState } from "react";

import type { BotDeeplinkData } from "@/lib/landing-blocks/types";

// Минимальный тип SDK MAX WebApp — берём только то, что реально дёргаем.
// Полное объявление живёт в app/m/[bot]/page.tsx, но здесь мы не хотим тянуть
// его глобально: renderer используется и на публичных лендингах вне MAX.
type MaxWebAppLike = {
  openMaxLink?: (url: string) => void;
  openLink?: (url: string) => void;
};

function getMaxWebApp(): MaxWebAppLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { WebApp?: MaxWebAppLike }).WebApp;
}

export interface BotDeeplinkRendererProps {
  id: string;
  data: BotDeeplinkData;
  /** username бота (без @). Берётся из bots.username. Без него URL собрать нельзя. */
  botUsername?: string;
}

/**
 * Строит deeplink на бота в MAX.
 * `startCommand` идёт в `?start=...` — принимаем как есть, но энкодим на всякий
 * случай, чтобы пейлоад с utm-метками/пробелами не сломал URL.
 */
function buildDeeplink(botUsername: string, startCommand?: string): string {
  const base = `https://max.ru/${botUsername}`;
  const start = startCommand?.trim();
  if (!start) return base;
  return `${base}?start=${encodeURIComponent(start)}`;
}

export default function BotDeeplinkRenderer({ id, data, botUsername }: BotDeeplinkRendererProps) {
  // Держим локальный флаг «клик обработан» только чтобы блокировать двойные
  // тапы — визуально ничего не меняем, deeplink уводит юзера в MAX.
  const [busy, setBusy] = useState(false);

  const username = botUsername?.trim();
  const url = username ? buildDeeplink(username, data.startCommand) : "";

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!url || busy) return;
      setBusy(true);
      // Пробуем SDK MAX. Если он есть — предотвращаем обычный переход, чтобы
      // клиент не открывал вторую вкладку поверх openMaxLink.
      // Если SDK нет — отпускаем дефолт, <a href> уведёт куда надо.
      const sdk = getMaxWebApp();
      if (sdk?.openMaxLink) {
        e.preventDefault();
        try {
          sdk.openMaxLink(url);
        } catch {
          // SDK иногда бросает если Mini App не был ready() — тогда fallback.
          window.location.href = url;
        }
      } else if (sdk?.openLink) {
        e.preventDefault();
        try {
          sdk.openLink(url);
        } catch {
          window.location.href = url;
        }
      }
      // Разрешаем повторный клик через тик — на случай, если открытие не удалось.
      setTimeout(() => setBusy(false), 800);
    },
    [url, busy],
  );

  // Полностью пустой блок (нет ни заголовка, ни кнопки, ни username) — прячем,
  // чтобы не оставлять «дыру» на публичной странице.
  if (!data.title?.trim() && !data.description?.trim() && !data.buttonText?.trim() && !username) {
    return null;
  }

  const buttonLabel = data.buttonText?.trim() || "Открыть в чате";
  const disabled = !url;

  return (
    <section
      id={`block-${id}`}
      data-block="bot_deeplink"
      className="lp-bot-deeplink"
      aria-labelledby={data.title ? `block-${id}-title` : undefined}
    >
      <div className="lp-bot-deeplink__card">
        {data.title?.trim() ? (
          <h3 id={`block-${id}-title`} className="lp-bot-deeplink__title">
            {data.title}
          </h3>
        ) : null}

        {data.description?.trim() ? (
          <p className="lp-bot-deeplink__desc">{data.description}</p>
        ) : null}

        {disabled ? (
          // Нет botUsername — редактор ещё не привязан к боту. Показываем
          // задизейбленную кнопку с подсказкой вместо мёртвой ссылки.
          <button
            type="button"
            className="lp-bot-deeplink__btn"
            disabled
            aria-disabled="true"
            title="Бот не привязан к странице"
          >
            {buttonLabel}
          </button>
        ) : (
          // href уводит юзера даже если JS упал — важно, потому что публичные
          // лендинги индексируются и должны работать без JS.
          <a
            className="lp-bot-deeplink__btn"
            href={url}
            target="_top"
            rel="noopener"
            onClick={onClick}
          >
            {buttonLabel}
          </a>
        )}
      </div>

      {/* Scoped styles — держим рядом с компонентом, чтобы блок был
          самодостаточным и не требовал правок глобального CSS. */}
      <style>{`
        .lp-bot-deeplink {
          width: 100%;
          max-width: 100%;
          padding: 12px 0;
          font-family: var(--font-onest), system-ui, -apple-system, sans-serif;
        }
        .lp-bot-deeplink__card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          max-width: 100%;
          padding: 20px;
          border-radius: 16px;
          background: var(--n-50, #F4F3EF);
          box-sizing: border-box;
        }
        .lp-bot-deeplink__title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.3;
          color: var(--n-900, #15141C);
        }
        .lp-bot-deeplink__desc {
          margin: 0;
          font-size: 14px;
          line-height: 1.45;
          color: var(--n-600, #4D4B43);
        }
        .lp-bot-deeplink__btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 48px;
          padding: 12px 20px;
          margin-top: 6px;
          border: 0;
          border-radius: 12px;
          background: var(--brand-violet, #5B47FB);
          color: var(--n-0, #FFFFFF);
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.2;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.05s ease;
          -webkit-tap-highlight-color: transparent;
          box-sizing: border-box;
        }
        .lp-bot-deeplink__btn:hover:not(:disabled) {
          background: var(--brand-violet-pressed, #4A38E0);
        }
        .lp-bot-deeplink__btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .lp-bot-deeplink__btn:disabled {
          background: var(--n-200, #DDDAD0);
          color: var(--n-500, #6F6D63);
          cursor: not-allowed;
        }
      `}</style>
    </section>
  );
}
