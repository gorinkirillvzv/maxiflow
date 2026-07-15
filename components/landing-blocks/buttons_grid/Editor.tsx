"use client";

// Inspector panel for the "buttons_grid" block. Fully controlled — каждый keystroke
// поднимает наверх через `onChange(nextData)`; wrapper в Block делает BlockEditor.
//
// Кнопки: label (обязательно), url, emoji (одна графема), bg (color-picker + пресеты).
// UX-ограничения (2-6 плиток) держим здесь, а не в types — чтобы не ломать импорт-DTO.

import type { ButtonsGridData, ButtonsGridItem } from "@/lib/landing-blocks/types";

const MIN_ITEMS = 1;
const MAX_ITEMS = 6;

// Пресеты фонов плиток. Подобраны под нашу палитру (--brand-violet и safe pastel'и),
// чтобы дефолтные значения смотрелись цельно в разных сочетаниях.
const BG_PRESETS: { name: string; value: string }[] = [
  { name: "Нет", value: "" },
  { name: "Violet", value: "#ECE9FF" },
  { name: "Amber", value: "#FFF3D6" },
  { name: "Coral", value: "#FFE1DC" },
  { name: "Green", value: "#DDF3E4" },
];

export interface ButtonsGridEditorProps {
  data: ButtonsGridData;
  onChange: (data: ButtonsGridData) => void;
  /** Unused here — сетка кнопок не грузит медиа, но сигнатура держится единой с остальными редакторами. */
  botId?: string;
}

export default function ButtonsGridEditor({ data, onChange }: ButtonsGridEditorProps) {
  const items: ButtonsGridItem[] = Array.isArray(data.items) ? data.items : [];

  // Все мутации — через хелперы, чтобы никогда не менять родительский `data` in-place.
  function patch(next: Partial<ButtonsGridData>) {
    onChange({ ...data, ...next });
  }

  function patchItem(index: number, next: Partial<ButtonsGridItem>) {
    const nextItems = items.map((it, i) => (i === index ? { ...it, ...next } : it));
    patch({ items: nextItems });
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    const nextItems: ButtonsGridItem[] = [
      ...items,
      { label: "", url: "", emoji: "" },
    ];
    patch({ items: nextItems });
  }

  function removeItem(index: number) {
    if (items.length <= MIN_ITEMS) return;
    patch({ items: items.filter((_, i) => i !== index) });
  }

  function moveItem(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const nextItems = items.slice();
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(target, 0, moved);
    patch({ items: nextItems });
  }

  return (
    <div className="kk-col kk-gap-3">
      {/* Заголовок сетки ----------------------------------------------------- */}
      <div>
        <label className="kk-label" htmlFor="bg-title">
          Заголовок блока (необязательно)
        </label>
        <input
          id="bg-title"
          className="kk-input"
          type="text"
          value={data.title ?? ""}
          placeholder="Например: Полезные материалы"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      {/* Список плиток ------------------------------------------------------ */}
      <div className="kk-col kk-gap-2">
        <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <label className="kk-label" style={{ margin: 0 }}>
            Кнопки ({items.length}/{MAX_ITEMS})
          </label>
        </div>

        {items.map((item, index) => {
          const currentBg = (item.bg ?? "").trim();
          return (
            <div key={`bg-item-${index}`} className="kk-card kk-pad-3 kk-col kk-gap-2">
              <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="kk-xs kk-muted">Кнопка {index + 1}</span>
                <div className="kk-row kk-gap-1">
                  <button
                    type="button"
                    className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label="Выше"
                    title="Выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Ниже"
                    title="Ниже"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
                    style={{ color: "var(--danger)" }}
                    onClick={() => removeItem(index)}
                    disabled={items.length <= MIN_ITEMS}
                    aria-label="Удалить"
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* label ------------------------------------------------------- */}
              <div>
                <label className="kk-label" htmlFor={`bg-label-${index}`}>
                  Подпись
                </label>
                <input
                  id={`bg-label-${index}`}
                  className="kk-input"
                  type="text"
                  value={item.label ?? ""}
                  placeholder="Например: Гайд по продукту"
                  onChange={(e) => patchItem(index, { label: e.target.value })}
                />
              </div>

              {/* url --------------------------------------------------------- */}
              <div>
                <label className="kk-label" htmlFor={`bg-url-${index}`}>
                  Ссылка (URL)
                </label>
                <input
                  id={`bg-url-${index}`}
                  className="kk-input"
                  type="url"
                  inputMode="url"
                  value={item.url ?? ""}
                  placeholder="https://max.ru/channel/..."
                  onChange={(e) => patchItem(index, { url: e.target.value })}
                />
              </div>

              {/* emoji ------------------------------------------------------- */}
              <div>
                <label className="kk-label" htmlFor={`bg-emoji-${index}`}>
                  Эмодзи (необязательно)
                </label>
                <input
                  id={`bg-emoji-${index}`}
                  className="kk-input"
                  type="text"
                  maxLength={4}
                  value={item.emoji ?? ""}
                  placeholder="📘"
                  onChange={(e) => patchItem(index, { emoji: e.target.value })}
                  style={{ maxWidth: 96 }}
                />
              </div>

              {/* bg ---------------------------------------------------------- */}
              <div>
                <label className="kk-label">Цвет фона</label>
                <div className="kk-row kk-gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    aria-label="Цвет фона (свой)"
                    type="color"
                    value={currentBg && /^#[0-9a-fA-F]{6}$/.test(currentBg) ? currentBg : "#F4F3EF"}
                    onChange={(e) => patchItem(index, { bg: e.target.value })}
                    style={{
                      width: 44,
                      height: 32,
                      padding: 0,
                      border: "1px solid var(--n-200, #DDDAD0)",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  />
                  <div className="kk-row kk-gap-1" style={{ flexWrap: "wrap" }}>
                    {BG_PRESETS.map((p) => {
                      const active = (currentBg || "") === p.value;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => patchItem(index, { bg: p.value })}
                          title={p.name}
                          aria-label={`Цвет: ${p.name}`}
                          aria-pressed={active}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: active
                              ? "2px solid var(--brand-violet, #5B47FB)"
                              : "1px solid var(--n-200, #DDDAD0)",
                            background: p.value || "var(--n-0, #FFFFFF)",
                            cursor: "pointer",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            color: "var(--n-500, #6F6D63)",
                          }}
                        >
                          {p.value ? "" : "×"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className="kk-btn kk-btn-ghost kk-btn-sm"
          onClick={addItem}
          disabled={items.length >= MAX_ITEMS}
        >
          + пункт
        </button>
      </div>
    </div>
  );
}
