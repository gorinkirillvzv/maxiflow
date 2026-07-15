"use client";

// Inspector for the "channel_card" block — «Подпишись на канал».
// Simple three-field form: heading, small description, button label.
// The actual channel / bot ids come from context (bots.channel_id, bots.channel_link),
// not from data, so the editor never touches URLs — that's a job for /bots settings.

import type { ChannelCardData } from "@/lib/landing-blocks/types";

export interface ChannelCardEditorProps {
  data: ChannelCardData;
  onChange: (next: ChannelCardData) => void;
  /** Unused here — channel card has no per-bot copy, kept for signature parity. */
  botId?: string;
}

export default function ChannelCardEditor({ data, onChange }: ChannelCardEditorProps) {
  function patch(next: Partial<ChannelCardData>) {
    onChange({ ...data, ...next });
  }

  return (
    <div className="kk-col kk-gap-3">
      <div>
        <label className="kk-label" htmlFor="channel-card-title">
          Заголовок
        </label>
        <input
          id="channel-card-title"
          className="kk-input"
          type="text"
          value={data.title}
          placeholder="Например: Подпишись на канал"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="channel-card-description">
          Описание
        </label>
        <textarea
          id="channel-card-description"
          className="kk-input"
          rows={2}
          value={data.description ?? ""}
          placeholder="Разборы, кейсы и апдейты — раз в пару дней, без спама."
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>

      <div>
        <label className="kk-label" htmlFor="channel-card-button">
          Текст кнопки
        </label>
        <input
          id="channel-card-button"
          className="kk-input"
          type="text"
          value={data.buttonText}
          placeholder="Подписаться"
          onChange={(e) => patch({ buttonText: e.target.value })}
        />
      </div>
    </div>
  );
}
