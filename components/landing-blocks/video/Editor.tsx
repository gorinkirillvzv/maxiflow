"use client";

// Inspector panel for the "video" block.
// Pure form: URL, optional forced provider, caption, container width.
// The renderer figures out the embed URL itself — we don't preview it here
// (BlockRenderer takes care of the live preview in the builder).
import type { MediaWidth, VideoData, VideoProvider } from "@/lib/landing-blocks/types";

export interface VideoEditorProps {
  data: VideoData;
  onChange: (data: VideoData) => void;
  /** Unused for video (no MediaPicker), but kept in the signature for the BlockEditor dispatcher. */
  botId?: string;
}

export default function VideoEditor({ data, onChange }: VideoEditorProps) {
  function patch(next: Partial<VideoData>) {
    onChange({ ...data, ...next });
  }

  return (
    <div className="kk-col kk-gap-3">
      <div className="kk-col kk-gap-2">
        <label className="kk-label" htmlFor="video-url">
          Ссылка на видео
        </label>
        <input
          id="video-url"
          type="url"
          className="kk-input"
          value={data.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://youtu.be/... или https://vk.com/video..."
          autoComplete="off"
          spellCheck={false}
        />
        <div className="kk-xs kk-muted" style={{ lineHeight: 1.5 }}>
          Поддерживаются YouTube (watch, shorts, youtu.be, embed) и VK Видео
          (ссылка из адресной строки или embed-код).
        </div>
      </div>

      <div className="kk-col kk-gap-2">
        <label className="kk-label" htmlFor="video-provider">
          Источник
        </label>
        <select
          id="video-provider"
          className="kk-input"
          value={data.provider}
          onChange={(e) => patch({ provider: e.target.value as VideoProvider })}
        >
          <option value="auto">Определить автоматически</option>
          <option value="youtube">YouTube</option>
          <option value="vk">VK Видео</option>
        </select>
      </div>

      <div className="kk-col kk-gap-2">
        <label className="kk-label" htmlFor="video-caption">
          Подпись под видео
        </label>
        <input
          id="video-caption"
          type="text"
          className="kk-input"
          value={data.caption}
          onChange={(e) => patch({ caption: e.target.value })}
          placeholder="Например: разбор кейса за 3 минуты"
        />
      </div>

      <div className="kk-col kk-gap-2">
        <label className="kk-label" htmlFor="video-width">
          Ширина блока
        </label>
        <select
          id="video-width"
          className="kk-input"
          value={data.width}
          onChange={(e) => patch({ width: e.target.value as MediaWidth })}
        >
          <option value="narrow">Узкая (до 480px)</option>
          <option value="wide">Обычная (по контейнеру)</option>
          <option value="full">Во всю ширину экрана</option>
        </select>
      </div>
    </div>
  );
}
