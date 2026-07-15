"use client";

// Inspector panel for the "image" landing block.
// Keeps state lifted — every field edit calls onChange with a fresh ImageData
// so undo/redo in the parent builder sees each keystroke as a discrete patch.
//
// When a botId is available we surface the shared MediaPicker so the user can
// pick from their bot's media library (uploaded photos live there as assets
// whose thumbnail_url resolves to the CDN image). Without a botId we degrade
// to a plain URL input — useful for previews / stand-alone editing outside
// the builder.
//
// Renders NO landing-page styles here — this is a form panel. All classes
// belong to the admin `kk-*` system.
import { useState } from "react";

import { MediaPicker, type MediaAsset } from "@/components/MediaPicker";
import type { ImageData, MediaWidth, TextAlign } from "@/lib/landing-blocks/types";

export interface ImageEditorProps {
  data: ImageData;
  onChange: (data: ImageData) => void;
  botId?: string;
}

const WIDTH_OPTIONS: Array<{ value: MediaWidth; label: string }> = [
  { value: "narrow", label: "Узкая (до 480px)" },
  { value: "wide", label: "Стандартная (в контейнере)" },
  { value: "full", label: "Во всю ширину экрана" },
];

const ALIGN_OPTIONS: Array<{ value: TextAlign; label: string }> = [
  { value: "left", label: "По левому краю" },
  { value: "center", label: "По центру" },
  { value: "right", label: "По правому краю" },
];

export default function ImageEditor({ data, onChange, botId }: ImageEditorProps) {
  // Track the token of the last picked asset so the MediaPicker can highlight
  // it. We don't persist the token in ImageData (renderer only needs the URL),
  // so this state lives inside the editor session.
  const [pickedToken, setPickedToken] = useState<string | undefined>(undefined);

  function patch(next: Partial<ImageData>) {
    onChange({ ...data, ...next });
  }

  function handlePick(asset: MediaAsset) {
    // For image assets the thumbnail_url is the CDN URL of the actual image
    // (MAX bot uploads store the file itself, not a shrunk thumb). If it's
    // absent for some reason we leave the URL as-is rather than blanking it.
    const url = asset.thumbnail_url ?? data.url;
    setPickedToken(asset.token);
    patch({
      url,
      // Only auto-fill alt if the user hasn't typed one yet — avoids clobbering
      // deliberate accessibility text on re-pick.
      alt: data.alt || asset.name || "",
    });
  }

  return (
    <div className="kk-col kk-gap-3">
      {botId ? (
        <div>
          <label className="kk-label">Изображение</label>
          <MediaPicker
            botId={botId}
            kind="image"
            selectedToken={pickedToken}
            onPick={handlePick}
          />
        </div>
      ) : null}

      <div>
        <label className="kk-label" htmlFor="image-url">URL картинки</label>
        <input
          id="image-url"
          className="kk-input"
          type="url"
          placeholder="https://example.com/photo.jpg"
          value={data.url}
          onChange={(e) => patch({ url: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="image-alt">
          Alt-текст (для SEO и незрячих)
        </label>
        <input
          id="image-alt"
          className="kk-input"
          type="text"
          placeholder="Например: юрист консультирует клиента"
          value={data.alt}
          onChange={(e) => patch({ alt: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="image-caption">Подпись под картинкой</label>
        <textarea
          id="image-caption"
          className="kk-input"
          rows={2}
          placeholder="Необязательно"
          value={data.caption}
          onChange={(e) => patch({ caption: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="image-width">Ширина</label>
        <select
          id="image-width"
          className="kk-input"
          value={data.width}
          onChange={(e) => patch({ width: e.target.value as MediaWidth })}
        >
          {WIDTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="kk-label" htmlFor="image-align">Выравнивание подписи</label>
        <select
          id="image-align"
          className="kk-input"
          value={data.align}
          onChange={(e) => patch({ align: e.target.value as TextAlign })}
        >
          {ALIGN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
