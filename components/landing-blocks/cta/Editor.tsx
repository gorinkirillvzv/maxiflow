"use client";

// Inspector panel for the "cta" landing block — repeat CTA banner further
// down the page. Fully controlled — every keystroke bubbles up via
// `onChange(nextData)`; the parent (BlockEditor) re-wraps into a full Block
// so this file stays scoped to `CtaData`.
//
// Renders NO landing-page styles here — this is a form panel. All classes
// belong to the admin `kk-*` system.

import type {
  AccentTheme,
  CtaConfig,
  CtaData,
  CtaDestinationType,
} from "@/lib/landing-blocks/types";

export interface CtaEditorProps {
  data: CtaData;
  onChange: (data: CtaData) => void;
  /** Unused here — CTA has no media, kept for signature parity with other editors. */
  botId?: string;
}

const THEME_OPTIONS: Array<{ value: AccentTheme; label: string }> = [
  { value: "light", label: "Светлый (мягкая подложка)" },
  { value: "dark", label: "Тёмный" },
  { value: "violet", label: "Фирменный фиолетовый" },
];

const DESTINATION_OPTIONS: Array<{ value: CtaDestinationType; label: string }> = [
  { value: "bot", label: "В бот на этой странице" },
  { value: "channel_post", label: "На пост в канале" },
  { value: "url", label: "На внешнюю ссылку" },
];

export default function CtaEditor({ data, onChange }: CtaEditorProps) {
  function patch(next: Partial<CtaData>) {
    onChange({ ...data, ...next });
  }

  function patchCta(next: Partial<CtaConfig>) {
    onChange({ ...data, cta: { ...data.cta, ...next } });
  }

  // URL field is meaningless when the CTA routes to the on-page bot funnel.
  const showUrl = data.cta.destinationType !== "bot";

  return (
    <div className="kk-col kk-gap-3">
      <div>
        <label className="kk-label" htmlFor="cta-title">
          Заголовок
        </label>
        <input
          id="cta-title"
          className="kk-input"
          type="text"
          value={data.title}
          placeholder="Например: Готовы разобрать вашу ситуацию?"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="cta-subtitle">
          Подзаголовок
        </label>
        <textarea
          id="cta-subtitle"
          className="kk-input"
          rows={2}
          value={data.subtitle}
          placeholder="Одно-два предложения, почему стоит нажать кнопку."
          onChange={(e) => patch({ subtitle: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="cta-theme">
          Фон
        </label>
        <select
          id="cta-theme"
          className="kk-input"
          value={data.theme}
          onChange={(e) => patch({ theme: e.target.value as AccentTheme })}
        >
          {THEME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="kk-label" htmlFor="cta-btn-text">
          Текст на кнопке
        </label>
        <input
          id="cta-btn-text"
          className="kk-input"
          type="text"
          value={data.cta.text}
          placeholder="Записаться на бесплатную консультацию"
          onChange={(e) => patchCta({ text: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="cta-destination">
          Куда ведёт кнопка
        </label>
        <select
          id="cta-destination"
          className="kk-input"
          value={data.cta.destinationType}
          onChange={(e) =>
            patchCta({ destinationType: e.target.value as CtaDestinationType })
          }
        >
          {DESTINATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {showUrl ? (
        <div>
          <label className="kk-label" htmlFor="cta-url">
            Ссылка
          </label>
          <input
            id="cta-url"
            className="kk-input"
            type="url"
            value={data.cta.url}
            placeholder="https://…"
            onChange={(e) => patchCta({ url: e.target.value })}
          />
        </div>
      ) : null}

      <div>
        <label className="kk-label" htmlFor="cta-goal">
          Цель в Метрике (необязательно)
        </label>
        <input
          id="cta-goal"
          className="kk-input"
          type="text"
          value={data.cta.goalName}
          placeholder="cta_click"
          onChange={(e) => patchCta({ goalName: e.target.value })}
        />
      </div>
    </div>
  );
}
