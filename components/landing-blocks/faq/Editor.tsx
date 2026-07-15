"use client";

// Inspector panel for the "faq" block. Fully controlled — every keystroke
// bubbles up via `onChange(nextData)`; the parent (BlockEditor) re-wraps it
// into a full Block so this file stays scoped to `FaqData`.

import type { FaqData, FaqItem } from "@/lib/landing-blocks/types";
import { newBlockId } from "@/lib/landing-blocks/defaults";

const MIN_ITEMS = 1;
const MAX_ITEMS = 8;

export interface FaqEditorProps {
  data: FaqData;
  onChange: (data: FaqData) => void;
  /** Unused here — FAQ has no per-item media, kept for signature parity. */
  botId?: string;
}

export default function FaqEditor({ data, onChange }: FaqEditorProps) {
  const items = Array.isArray(data.items) ? data.items : [];

  // Every mutation goes through these helpers so we never accidentally mutate
  // the parent's `data` object in place.
  function patch(next: Partial<FaqData>) {
    onChange({ ...data, ...next });
  }

  function patchItem(index: number, next: Partial<FaqItem>) {
    const nextItems = items.map((it, i) => (i === index ? { ...it, ...next } : it));
    patch({ items: nextItems });
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    const nextItems: FaqItem[] = [
      ...items,
      {
        id: newBlockId(),
        question: "",
        answer: "",
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
        <label className="kk-label" htmlFor="faq-title">
          Заголовок блока
        </label>
        <input
          id="faq-title"
          className="kk-input"
          type="text"
          value={data.title}
          placeholder="Например: Частые вопросы"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      {/* Items list ------------------------------------------------------- */}
      <div className="kk-col kk-gap-2">
        <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <label className="kk-label" style={{ margin: 0 }}>
            Вопросы ({items.length}/{MAX_ITEMS})
          </label>
        </div>

        {items.map((item, index) => (
          <div key={item.id} className="kk-card kk-pad-3 kk-col kk-gap-2">
            <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="kk-xs kk-muted">Вопрос {index + 1}</span>
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
              <label className="kk-label" htmlFor={`faq-q-${item.id}`}>
                Вопрос
              </label>
              <input
                id={`faq-q-${item.id}`}
                className="kk-input"
                type="text"
                value={item.question}
                placeholder="Например: Сколько стоит консультация?"
                onChange={(e) => patchItem(index, { question: e.target.value })}
              />
            </div>

            <div>
              <label className="kk-label" htmlFor={`faq-a-${item.id}`}>
                Ответ
              </label>
              <textarea
                id={`faq-a-${item.id}`}
                className="kk-input"
                rows={3}
                value={item.answer}
                placeholder="Короткий, конкретный ответ. Пустая строка — новый абзац."
                onChange={(e) => patchItem(index, { answer: e.target.value })}
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
          + вопрос
        </button>
      </div>
    </div>
  );
}
