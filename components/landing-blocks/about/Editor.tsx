"use client";
// About editor — sidebar form shown in the landing builder's Inspector.
// Zero styling for the public page: everything below is the admin cabinet.
// Renders only labels + inputs. All state lifts through onChange(next).

import { MediaPicker, type MediaAsset } from "@/components/MediaPicker";
import type { AboutData } from "@/lib/landing-blocks/types";

export interface AboutEditorProps {
  data: AboutData;
  onChange: (data: AboutData) => void;
  /** Bot the landing belongs to — needed by MediaPicker. Optional so the editor
   *  still works in previews that haven't wired a bot yet (picker is hidden). */
  botId?: string;
}

// UI cap. The renderer also enforces this so tenants importing older data
// don't overflow the card, but we want to prevent authoring beyond the limit.
const MAX_BADGES = 4;

export default function AboutEditor({ data, onChange, botId }: AboutEditorProps) {
  const patch = (partial: Partial<AboutData>) => onChange({ ...data, ...partial });

  const badges = data.badges ?? [];

  const setBadge = (index: number, value: string) => {
    const next = badges.slice();
    next[index] = value;
    patch({ badges: next });
  };

  const removeBadge = (index: number) => {
    const next = badges.slice();
    next.splice(index, 1);
    patch({ badges: next });
  };

  const addBadge = () => {
    if (badges.length >= MAX_BADGES) return;
    patch({ badges: [...badges, ""] });
  };

  const canAddBadge = badges.length < MAX_BADGES;

  return (
    <div className="kk-col kk-gap-4">
      {/* --- Photo ---------------------------------------------------------- */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label">Фото эксперта</label>
        <input
          className="kk-input"
          type="url"
          value={data.photoUrl}
          placeholder="URL картинки или выбери ниже"
          onChange={(e) => patch({ photoUrl: e.target.value })}
        />
        {data.photoUrl ? (
          <div className="kk-row kk-gap-2" style={{ marginTop: 4 }}>
            {/* Little preview so authors verify the URL resolves. */}
            <img
              src={data.photoUrl}
              alt=""
              style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--n-200)" }}
            />
            <button
              type="button"
              className="kk-btn kk-btn-ghost kk-btn-sm"
              onClick={() => patch({ photoUrl: "" })}
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
              patch({ photoUrl: url });
            }}
          />
        ) : null}
      </div>

      {/* --- Name ----------------------------------------------------------- */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="about-name">Имя</label>
        <input
          id="about-name"
          className="kk-input"
          type="text"
          value={data.name}
          placeholder="Иван Петров"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>

      {/* --- Role ----------------------------------------------------------- */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="about-role">Роль / регалии в одну строку</label>
        <input
          id="about-role"
          className="kk-input"
          type="text"
          value={data.role}
          placeholder="Психолог • 7+ лет практики"
          onChange={(e) => patch({ role: e.target.value })}
        />
      </div>

      {/* --- Bio ------------------------------------------------------------ */}
      <div className="kk-col" style={{ gap: 6 }}>
        <label className="kk-label" htmlFor="about-bio">Био</label>
        <textarea
          id="about-bio"
          className="kk-input"
          rows={4}
          value={data.bio}
          placeholder="Коротко о себе: образование, специализация, результаты"
          onChange={(e) => patch({ bio: e.target.value })}
          style={{ resize: "vertical", minHeight: 96, padding: "10px 12px", lineHeight: 1.5 }}
        />
      </div>

      {/* --- Badges --------------------------------------------------------- */}
      <div className="kk-col" style={{ gap: 6 }}>
        <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <label className="kk-label" style={{ margin: 0 }}>
            Бейджи (регалии, до {MAX_BADGES})
          </label>
          <span className="kk-xs kk-muted">{badges.length} / {MAX_BADGES}</span>
        </div>

        {badges.length === 0 ? (
          <div className="kk-xs kk-muted" style={{ marginBottom: 4 }}>
            Например: «500+ клиентов», «МГУ / психфак», «Спикер конференций».
          </div>
        ) : null}

        <div className="kk-col kk-gap-2">
          {badges.map((badge, i) => (
            <div key={i} className="kk-row kk-gap-2" style={{ alignItems: "center" }}>
              <input
                className="kk-input"
                type="text"
                value={badge}
                placeholder={`Бейдж ${i + 1}`}
                onChange={(e) => setBadge(i, e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
                onClick={() => removeBadge(i)}
                aria-label="Удалить бейдж"
                title="Удалить"
                style={{ color: "var(--danger)" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="kk-btn kk-btn-ghost kk-btn-sm"
          onClick={addBadge}
          disabled={!canAddBadge}
          style={{ marginTop: 4, alignSelf: "flex-start", opacity: canAddBadge ? 1 : 0.5 }}
        >
          + бейдж
        </button>
      </div>
    </div>
  );
}
