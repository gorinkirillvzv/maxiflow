"use client";

// Inspector panel for the "features" block. Fully controlled — every keystroke
// bubbles up via `onChange(nextData)`; the parent (BlockEditor) re-wraps it
// into a full Block so this file stays scoped to `FeaturesData`.

import type { FeatureItem, FeaturesData } from "@/lib/landing-blocks/types";
import { newBlockId } from "@/lib/landing-blocks/defaults";

const MIN_ITEMS = 1;
const MAX_ITEMS = 6;

export interface FeaturesEditorProps {
  data: FeaturesData;
  onChange: (data: FeaturesData) => void;
  /** Unused here — features have no per-item media, kept for signature parity. */
  botId?: string;
}

export default function FeaturesEditor({ data, onChange }: FeaturesEditorProps) {
  const items = Array.isArray(data.items) ? data.items : [];

  // Every mutation goes through these helpers so we never accidentally mutate
  // the parent's `data` object in place.
  function patch(next: Partial<FeaturesData>) {
    onChange({ ...data, ...next });
  }

  function patchItem(index: number, next: Partial<FeatureItem>) {
    const nextItems = items.map((it, i) => (i === index ? { ...it, ...next } : it));
    patch({ items: nextItems });
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    const nextItems: FeatureItem[] = [
      ...items,
      {
        id: newBlockId(),
        icon: "✓",
        title: "",
        description: "",
      },
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
      {/* Section heading -------------------------------------------------- */}
      <div>
        <label className="kk-label" htmlFor="features-title">
          Заголовок блока
        </label>
        <input
          id="features-title"
          className="kk-input"
          type="text"
          value={data.title}
          placeholder="Например: Почему выбирают нас"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      {/* Column layout ---------------------------------------------------- */}
      <div>
        <label className="kk-label" htmlFor="features-columns">
          Раскладка
        </label>
        <select
          id="features-columns"
          className="kk-input"
          value={String(data.columns)}
          onChange={(e) => {
            const n = Number(e.target.value);
            const cols: 1 | 2 | 3 = n === 2 ? 2 : n === 3 ? 3 : 1;
            patch({ columns: cols });
          }}
        >
          <option value="1">1 колонка (список)</option>
          <option value="2">2 колонки</option>
          <option value="3">3 колонки</option>
        </select>
      </div>

      {/* Items list ------------------------------------------------------- */}
      <div className="kk-col kk-gap-2">
        <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <label className="kk-label" style={{ margin: 0 }}>
            Пункты ({items.length}/{MAX_ITEMS})
          </label>
        </div>

        {items.map((item, index) => (
          <div key={item.id} className="kk-card kk-pad-3 kk-col kk-gap-2">
            <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="kk-xs kk-muted">Пункт {index + 1}</span>
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

            <div>
              <label className="kk-label" htmlFor={`features-icon-${item.id}`}>
                Иконка (эмодзи или символ)
              </label>
              <input
                id={`features-icon-${item.id}`}
                className="kk-input"
                type="text"
                maxLength={4}
                value={item.icon}
                placeholder="✓"
                onChange={(e) => patchItem(index, { icon: e.target.value })}
                style={{ maxWidth: 96 }}
              />
            </div>

            <div>
              <label className="kk-label" htmlFor={`features-title-${item.id}`}>
                Заголовок пункта
              </label>
              <input
                id={`features-title-${item.id}`}
                className="kk-input"
                type="text"
                value={item.title}
                placeholder="Например: Индивидуальный подход"
                onChange={(e) => patchItem(index, { title: e.target.value })}
              />
            </div>

            <div>
              <label className="kk-label" htmlFor={`features-desc-${item.id}`}>
                Описание
              </label>
              <textarea
                id={`features-desc-${item.id}`}
                className="kk-input"
                rows={2}
                value={item.description}
                placeholder="Одно-два предложения — короче, чем кажется."
                onChange={(e) => patchItem(index, { description: e.target.value })}
              />
            </div>
          </div>
        ))}

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
