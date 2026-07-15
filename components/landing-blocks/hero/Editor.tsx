"use client";
// Hero editor — sidebar form shown in the landing builder's Inspector.
// Zero styling for the public page: everything below is the admin cabinet.
// Renders only labels + inputs. All state lifts through onChange(next).

import { MediaPicker, type MediaAsset } from "@/components/MediaPicker";
import type {
  AccentTheme,
  CtaConfig,
  CtaDestinationType,
  HeroData,
  TextAlign,
} from "@/lib/landing-blocks/types";

export interface HeroEditorProps {
  data: HeroData;
  onChange: (data: HeroData) => void;
  /** Bot the landing belongs to — needed by MediaPicker. Optional so the editor
   *  still works in previews that haven't wired a bot yet (picker is hidden). */
  botId?: string;
}

const THEMES: { value: AccentTheme; label: string }[] = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "violet", label: "Фирменная" },
];

const ALIGNS: { value: TextAlign; label: string }[] = [
  { value: "left", label: "Слева" },
  { value: "center", label: "По центру" },
  { value: "right", label: "Справа" },
];

const DESTINATIONS: { value: CtaDestinationType; label: string; hint: string }[] = [
  { value: "bot", label: "Форма заявки", hint: "Клик открывает форму лендинга" },
  { value: "channel_post", label: "Пост в канале", hint: "Ссылка на конкретный пост" },
  { value: "url", label: "Внешняя ссылка", hint: "Любой URL: сайт, мессенджер, форма" },
];

export default function HeroEditor({ data, onChange, botId }: HeroEditorProps) {
  // Small helpers keep the JSX below flat — every field mutates one key of
  // HeroData / HeroData.cta and lifts the full object to the parent.
  const patch = (partial: Partial<HeroData>) => onChange({ ...data, ...partial });
  const patchCta = (partial: Partial<CtaConfig>) =>
    onChange({ ...data, cta: { ...data.cta, ...partial } });

  const showUrlField = data.cta.destinationType !== "bot";
  const destHint = DESTINATIONS.find((d) => d.value === data.cta.destinationType)?.hint;

  return (
    <div className="kk-col kk-gap-4">
      {/* --- Content --------------------------------------------------------- */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="hero-title">Заголовок</label>
        <input
          id="hero-title"
          className="kk-input"
          type="text"
          value={data.title}
          placeholder="Бесплатная консультация эксперта"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="hero-subtitle">Подзаголовок</label>
        <textarea
          id="hero-subtitle"
          className="kk-input"
          rows={2}
          value={data.subtitle}
          placeholder="Коротко — что получит клиент и почему это ему нужно"
          onChange={(e) => patch({ subtitle: e.target.value })}
          style={{ resize: "vertical", minHeight: 60, padding: "10px 12px", lineHeight: 1.5 }}
        />
      </div>

      {/* --- CTA button ------------------------------------------------------ */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="hero-cta-text">Текст кнопки</label>
        <input
          id="hero-cta-text"
          className="kk-input"
          type="text"
          value={data.cta.text}
          placeholder="Записаться бесплатно"
          onChange={(e) => patchCta({ text: e.target.value })}
        />
      </div>

      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="hero-cta-dest">Действие по клику</label>
        <select
          id="hero-cta-dest"
          className="kk-input"
          value={data.cta.destinationType}
          onChange={(e) =>
            patchCta({ destinationType: e.target.value as CtaDestinationType })
          }
        >
          {DESTINATIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        {destHint ? (
          <div className="kk-xs kk-muted">{destHint}</div>
        ) : null}
      </div>

      {showUrlField ? (
        <div className="kk-col" style={{ gap: 6 }}>
          <label className="kk-label" htmlFor="hero-cta-url">Ссылка</label>
          <input
            id="hero-cta-url"
            className="kk-input"
            type="url"
            value={data.cta.url}
            placeholder="https://…"
            onChange={(e) => patchCta({ url: e.target.value })}
          />
        </div>
      ) : null}

      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="hero-goal">Цель Яндекс.Метрики (опц.)</label>
        <input
          id="hero-goal"
          className="kk-input"
          type="text"
          value={data.cta.goalName}
          placeholder="hero_click"
          onChange={(e) => patchCta({ goalName: e.target.value })}
        />
      </div>

      {/* --- Appearance ------------------------------------------------------ */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="hero-theme">Оформление</label>
        <select
          id="hero-theme"
          className="kk-input"
          value={data.theme}
          onChange={(e) => patch({ theme: e.target.value as AccentTheme })}
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="hero-align">Выравнивание текста</label>
        <select
          id="hero-align"
          className="kk-input"
          value={data.align}
          onChange={(e) => patch({ align: e.target.value as TextAlign })}
        >
          {ALIGNS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {/* --- Image ----------------------------------------------------------- */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label">Картинка справа</label>
        <input
          className="kk-input"
          type="url"
          value={data.imageUrl}
          placeholder="URL картинки или выбери ниже"
          onChange={(e) => patch({ imageUrl: e.target.value })}
        />
        {data.imageUrl ? (
          <div className="kk-row kk-gap-2" style={{ marginTop: 4 }}>
            {/* Little preview so authors verify the URL resolves. */}
            <img
              src={data.imageUrl}
              alt=""
              style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid var(--n-200)" }}
            />
            <button
              type="button"
              className="kk-btn kk-btn-ghost kk-btn-sm"
              onClick={() => patch({ imageUrl: "", imageAlt: "" })}
            >
              Убрать
            </button>
          </div>
        ) : null}

        {botId ? (
          <MediaPicker
            botId={botId}
            kind="image"
            selectedToken={undefined}
            onPick={(asset: MediaAsset) => {
              // Prefer a thumbnail URL if the picker has one; falls back to
              // token so downstream can resolve via the media proxy later.
              const url = asset.thumbnail_url || asset.token;
              patch({ imageUrl: url, imageAlt: data.imageAlt || asset.name || "" });
            }}
          />
        ) : null}
      </div>

      {data.imageUrl ? (
        <div className="kk-col" style={{ gap: 6 }}>
          <label className="kk-label" htmlFor="hero-alt">Alt-текст картинки</label>
          <input
            id="hero-alt"
            className="kk-input"
            type="text"
            value={data.imageAlt}
            placeholder="Что на фото — коротко, для SEO и скринридеров"
            onChange={(e) => patch({ imageAlt: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
