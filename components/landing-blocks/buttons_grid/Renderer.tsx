"use client";

// Buttons grid renderer — сетка «плиток» с эмодзи + подписью, tap ведёт по URL.
// Основной блок Mini App: 2-6 кнопок-ссылок на посты канала / внешние ресурсы.
//
// Client-only, потому что для max.ru-ссылок пытаемся использовать MAX WebApp SDK
// (`window.WebApp.openMaxLink`) — открывает ссылку внутри клиента MAX без выхода.
// Для остальных URL — обычный window.location.

import type { ButtonsGridData, ButtonsGridItem } from "@/lib/landing-blocks/types";

export interface ButtonsGridRendererProps {
  id: string;
  data: ButtonsGridData;
}

/** Пытаемся угадать, что ссылка ведёт на ресурс MAX (канал/пост/бота).
 *  Только для таких URL зовём SDK — иначе openMaxLink на внешний домен молча падает. */
function isMaxUrl(url: string): boolean {
  try {
    const u = new URL(url, "https://max.ru");
    return u.hostname === "max.ru" || u.hostname.endsWith(".max.ru");
  } catch {
    return false;
  }
}

function openUrl(url: string) {
  if (!url) return;
  const trimmed = url.trim();
  if (!trimmed) return;

  // MAX SDK: доступен, если Mini App запущен внутри клиента MAX.
  const sdk = (typeof window !== "undefined"
    ? (window as unknown as { WebApp?: { openMaxLink?: (u: string) => void; openLink?: (u: string) => void } }).WebApp
    : undefined);

  if (sdk?.openMaxLink && isMaxUrl(trimmed)) {
    try { sdk.openMaxLink(trimmed); return; } catch { /* fallthrough */ }
  }
  if (sdk?.openLink) {
    try { sdk.openLink(trimmed); return; } catch { /* fallthrough */ }
  }
  if (typeof window !== "undefined") {
    window.location.href = trimmed;
  }
}

export default function ButtonsGridRenderer({ id, data }: ButtonsGridRendererProps) {
  const items: ButtonsGridItem[] = Array.isArray(data.items) ? data.items : [];

  // Прячем блок целиком, если нет ни заголовка, ни кнопок — чтобы пустая заглушка
  // не оставляла дыру на публичной странице.
  if (items.length === 0 && !data.title?.trim()) return null;

  return (
    <section
      id={`block-${id}`}
      data-block="buttons_grid"
      className="bg-block"
      aria-labelledby={data.title ? `block-${id}-title` : undefined}
    >
      {data.title?.trim() ? (
        <h3 id={`block-${id}-title`} className="bg-title">
          {data.title}
        </h3>
      ) : null}

      {items.length > 0 ? (
        <div className="bg-grid" role="list">
          {items.map((item, idx) => {
            const label = item.label?.trim() || "";
            const emoji = item.emoji?.trim() || "";
            const url = item.url?.trim() || "";
            const bg = item.bg?.trim() || "";
            const disabled = url.length === 0;

            return (
              <button
                key={`${id}-${idx}`}
                type="button"
                role="listitem"
                className="bg-tile"
                onClick={() => { if (!disabled) openUrl(url); }}
                disabled={disabled}
                aria-label={label || "Кнопка"}
                style={bg ? { background: bg } : undefined}
              >
                {emoji ? <span className="bg-tile-emoji" aria-hidden="true">{emoji}</span> : null}
                <span className="bg-tile-label">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <style>{`
        .bg-block {
          max-width: 100%;
          padding: 12px 16px;
          font-family: var(--font-onest), system-ui, -apple-system, "Segoe UI", sans-serif;
          color: var(--n-900, #15141C);
        }
        .bg-title {
          margin: 0 0 12px;
          font-size: 18px;
          line-height: 1.3;
          font-weight: 700;
          color: var(--n-900, #15141C);
        }
        .bg-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        /* На узких экранах — одна колонка, чтобы плитки не сжимались до нечитаемых. */
        @media (max-width: 360px) {
          .bg-grid { grid-template-columns: 1fr; }
        }
        .bg-tile {
          -webkit-tap-highlight-color: transparent;
          appearance: none;
          border: 0;
          margin: 0;
          padding: 16px;
          min-height: 76px;   /* > 44px гарантированный тап-таргет */
          width: 100%;
          border-radius: 16px;
          background: var(--n-50, #F4F3EF);
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
        }
        .bg-tile:active {
          transform: scale(0.98);
          filter: brightness(0.96);
        }
        .bg-tile:focus-visible {
          outline: 2px solid var(--brand-violet, #5B47FB);
          outline-offset: 2px;
        }
        .bg-tile[disabled] {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .bg-tile-emoji {
          font-size: 28px;
          line-height: 1;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
        }
        .bg-tile-label {
          font-size: 15px;
          line-height: 1.3;
          font-weight: 600;
          word-break: break-word;
        }
      `}</style>
    </section>
  );
}
