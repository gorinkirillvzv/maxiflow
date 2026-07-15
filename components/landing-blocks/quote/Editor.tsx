"use client";

// Inspector panel for the `quote` block. Four fields — quote text, author name,
// author title/role, and avatar URL. When a botId is available (i.e. the block
// is edited inside a bot-scoped landing), we also mount MediaPicker so the
// author avatar can be picked from the tenant's media library instead of
// pasting an external URL. The URL input stays as the source of truth in
// either case — MediaPicker just writes into it.

import type { QuoteData } from "@/lib/landing-blocks/types";
import { MediaPicker, type MediaAsset } from "@/components/MediaPicker";

export interface QuoteEditorProps {
  data: QuoteData;
  onChange: (data: QuoteData) => void;
  /** Optional — enables the "pick from library" affordance for the avatar. */
  botId?: string;
}

export default function QuoteEditor({ data, onChange, botId }: QuoteEditorProps) {
  const setText = (text: string) => onChange({ ...data, text });
  const setAuthorName = (authorName: string) => onChange({ ...data, authorName });
  const setAuthorTitle = (authorTitle: string) => onChange({ ...data, authorTitle });
  const setAvatarUrl = (authorAvatarUrl: string) =>
    onChange({ ...data, authorAvatarUrl });

  const onPickAvatar = (asset: MediaAsset) => {
    // Uploaded images expose a public `thumbnail_url` — reuse it as the
    // rendered avatar URL. If MAX returned nothing, keep whatever the user
    // already typed rather than blanking the field.
    if (asset.thumbnail_url) setAvatarUrl(asset.thumbnail_url);
  };

  return (
    <div className="kk-col kk-gap-3">
      <div className="kk-col kk-gap-1">
        <label className="kk-label" htmlFor="quote-block-text">
          Текст отзыва
        </label>
        <textarea
          id="quote-block-text"
          className="kk-input"
          rows={4}
          value={data.text}
          placeholder="Пришла с чувством, что запуталась окончательно. За одну встречу разложили всё по полочкам…"
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="kk-col kk-gap-1">
        <label className="kk-label" htmlFor="quote-block-author-name">
          Имя автора
        </label>
        <input
          id="quote-block-author-name"
          className="kk-input"
          type="text"
          value={data.authorName}
          placeholder="Анна"
          onChange={(e) => setAuthorName(e.target.value)}
        />
      </div>

      <div className="kk-col kk-gap-1">
        <label className="kk-label" htmlFor="quote-block-author-title">
          Должность / подпись
        </label>
        <input
          id="quote-block-author-title"
          className="kk-input"
          type="text"
          value={data.authorTitle}
          placeholder="клиент, Москва"
          onChange={(e) => setAuthorTitle(e.target.value)}
        />
      </div>

      <div className="kk-col kk-gap-1">
        <label className="kk-label" htmlFor="quote-block-avatar-url">
          Аватар (URL)
        </label>
        <input
          id="quote-block-avatar-url"
          className="kk-input"
          type="url"
          value={data.authorAvatarUrl}
          placeholder="https://…"
          onChange={(e) => setAvatarUrl(e.target.value)}
        />
        {data.authorAvatarUrl?.trim() ? (
          <div style={{ marginTop: 6 }}>
            {/* Live preview so authors immediately see whether the URL loads. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.authorAvatarUrl}
              alt=""
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--n-100)",
                background: "var(--n-25)",
              }}
            />
          </div>
        ) : (
          <div className="kk-xs kk-muted" style={{ marginTop: 4 }}>
            Пусто — покажем кружок с инициалами.
          </div>
        )}

        {botId ? (
          <MediaPicker
            botId={botId}
            kind="image"
            selectedToken={undefined}
            onPick={onPickAvatar}
          />
        ) : null}
      </div>
    </div>
  );
}
