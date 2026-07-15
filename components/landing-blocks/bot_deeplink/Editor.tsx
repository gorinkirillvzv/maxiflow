"use client";

// Inspector-панель для блока "bot_deeplink" — четыре текстовых поля.
// Полностью контролируемая форма: каждый keystroke сразу летит через
// onChange(next) вверх, а обёртка Block <-> data живёт в BlockEditor.

import type { BotDeeplinkData } from "@/lib/landing-blocks/types";

export interface BotDeeplinkEditorProps {
  data: BotDeeplinkData;
  onChange: (next: BotDeeplinkData) => void;
  /** Не используется этим блоком, оставлено для сигнатурной совместимости. */
  botId?: string;
}

export default function BotDeeplinkEditor({ data, onChange }: BotDeeplinkEditorProps) {
  // Точечный патчер — никогда не мутируем `data` на месте, чтобы React в
  // родителе честно увидел смену ссылки.
  function patch(next: Partial<BotDeeplinkData>) {
    onChange({ ...data, ...next });
  }

  return (
    <div className="kk-col kk-gap-3">
      {/* Title -------------------------------------------------------- */}
      <div>
        <label className="kk-label" htmlFor="botdl-title">
          Заголовок
        </label>
        <input
          id="botdl-title"
          className="kk-input"
          type="text"
          value={data.title}
          placeholder="Например: Открыть бота"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      {/* Description -------------------------------------------------- */}
      <div>
        <label className="kk-label" htmlFor="botdl-desc">
          Описание
        </label>
        <textarea
          id="botdl-desc"
          className="kk-input"
          rows={2}
          value={data.description ?? ""}
          placeholder="Коротко — зачем пользователю нажимать кнопку."
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>

      {/* Button text -------------------------------------------------- */}
      <div>
        <label className="kk-label" htmlFor="botdl-btn">
          Текст кнопки
        </label>
        <input
          id="botdl-btn"
          className="kk-input"
          type="text"
          value={data.buttonText}
          placeholder="Например: Открыть в чате"
          onChange={(e) => patch({ buttonText: e.target.value })}
        />
      </div>

      {/* Start command ------------------------------------------------ */}
      <div>
        <label className="kk-label" htmlFor="botdl-start">
          Start-параметр (необязательно)
        </label>
        <input
          id="botdl-start"
          className="kk-input"
          type="text"
          value={data.startCommand ?? ""}
          placeholder="welcome, utm_ads, pc_abc123…"
          onChange={(e) => patch({ startCommand: e.target.value })}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="kk-xs kk-muted" style={{ marginTop: 4 }}>
          Значение уходит боту как <code>?start=…</code> — можно использовать для UTM или сценариев.
        </div>
      </div>
    </div>
  );
}
