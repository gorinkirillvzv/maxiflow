"use client";

// LandingBuilder — редактор блочного лендинга.
//
// Три колонки:
//   1) Левая (300px) — палитра блоков. Клик добавляет новый блок в конец.
//   2) Центр (гибкая ширина) — канвас: список BlockEditor'ов с кнопками
//      «↑ / ↓ / ×» и подсветкой выбранного.
//   3) Внизу канваса — «Сохранить» и «Просмотр».
//
// State хранится локально; PATCH /api/landings отправляется по кнопке
// «Сохранить». Drag/drop намеренно не реализуем — кнопки простее и надёжнее.

import { useEffect, useState } from "react";
import BlockEditor from "@/components/landing-blocks/BlockEditor";
import { newBlock } from "@/lib/landing-blocks/defaults";
import {
  BLOCK_DESCRIPTIONS,
  BLOCK_LABELS,
  BLOCK_TYPES,
  type Block,
  type BlockType,
} from "@/lib/landing-blocks/types";

export interface LandingBuilderProps {
  landingId: string;
  /** slug — используется только как подпись «/lp/<slug>» в палитре. Опционален,
   *  чтобы конструктор можно было переиспользовать в Mini App, где slug'a нет. */
  slug?: string;
  initialBlocks: Block[];
  /** URL публичного лендинга — открываем в новой вкладке по «Просмотр». */
  publicUrl: string;
  botId?: string;   // для MediaPicker в hero/image/quote/about редакторах
  /** Кастомный обработчик сохранения. Если задан — используется вместо
   *  дефолтного PATCH /api/landings. Позволяет переиспользовать редактор
   *  в другом контексте (Mini App пишет через PATCH /api/mini-app). */
  onSave?: (blocks: Block[]) => Promise<void>;
}

export default function LandingBuilder({
  landingId,
  slug,
  initialBlocks,
  publicUrl,
  botId,
  onSave,
}: LandingBuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialBlocks[0]?.id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);
  // Помечаем «грязный» стейт, чтобы кнопка «Сохранить» подсвечивалась
  // и мы могли предупредить о несохранённых правках перед выходом.
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function addBlock(type: BlockType) {
    const nb = newBlock(type);
    setBlocks((prev) => [...prev, nb]);
    setSelectedId(nb.id);
    setDirty(true);
    setStatus(null);
  }

  function updateBlock(next: Block) {
    setBlocks((prev) => prev.map((b) => (b.id === next.id ? next : b)));
    setDirty(true);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = prev.slice();
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
    setDirty(true);
  }

  function removeBlock(id: string) {
    if (!confirm("Удалить блок?")) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      if (onSave) {
        // Кастомный обработчик (например Mini App) — сам решает как персистить.
        // Ошибки поднимает throw'ом; success = зелёный статус.
        await onSave(blocks);
        setStatus({ kind: "ok", text: "Сохранено" });
        setDirty(false);
      } else {
        const r = await fetch("/api/landings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: landingId, blocks }),
        });
        const d = await r.json();
        if (!r.ok) {
          setStatus({ kind: "err", text: d.error || "Ошибка сохранения" });
        } else {
          setStatus({ kind: "ok", text: "Сохранено" });
          setDirty(false);
        }
      }
    } catch (e) {
      setStatus({
        kind: "err",
        text: e instanceof Error ? e.message : "Ошибка сети",
      });
    } finally {
      setSaving(false);
    }
  }

  function preview() {
    if (dirty) {
      if (!confirm("Есть несохранённые изменения. Открыть предпросмотр без них?")) {
        return;
      }
    }
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gap: 20,
        padding: "20px 24px",
        alignItems: "start",
      }}
    >
      {/* --- Палитра блоков --------------------------------------------- */}
      <aside
        className="kk-card kk-pad-4"
        style={{ position: "sticky", top: 20, alignSelf: "start" }}
      >
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
          Добавить блок
        </div>
        <div className="kk-col kk-gap-1">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className="kk-btn kk-btn-ghost"
              onClick={() => addBlock(t)}
              style={{
                justifyContent: "flex-start",
                textAlign: "left",
                height: "auto",
                padding: "8px 10px",
                whiteSpace: "normal",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {BLOCK_LABELS[t]}
                </span>
                <span
                  className="kk-xs kk-muted"
                  style={{ lineHeight: 1.35, whiteSpace: "normal" }}
                >
                  {BLOCK_DESCRIPTIONS[t]}
                </span>
              </div>
            </button>
          ))}
        </div>
        {slug ? (
          <div
            className="kk-xs kk-muted"
            style={{ marginTop: 12, lineHeight: 1.5 }}
          >
            slug: <b>/lp/{slug}</b>
          </div>
        ) : null}
      </aside>

      {/* --- Канвас ------------------------------------------------------ */}
      <div style={{ minWidth: 0 }}>
        {blocks.length === 0 ? (
          <div
            className="kk-card kk-pad-5 kk-muted kk-sm"
            style={{ textAlign: "center" }}
          >
            Пока пусто. Слева нажми «Обложка», чтобы добавить первый блок.
          </div>
        ) : (
          <div className="kk-col kk-gap-3">
            {blocks.map((block, i) => (
              <div
                key={block.id}
                className="kk-card kk-pad-4"
                style={{
                  outline:
                    selectedId === block.id
                      ? "2px solid var(--brand-violet)"
                      : "none",
                  outlineOffset: 2,
                }}
                onClick={() => setSelectedId(block.id)}
              >
                <div
                  className="kk-row"
                  style={{
                    justifyContent: "space-between",
                    marginBottom: 12,
                    alignItems: "center",
                  }}
                >
                  <div className="kk-row kk-gap-2" style={{ alignItems: "center" }}>
                    <span
                      className="kk-chip"
                      style={{ height: 22, fontSize: 11 }}
                    >
                      {i + 1}. {BLOCK_LABELS[block.type]}
                    </span>
                  </div>
                  <div className="kk-row kk-gap-1">
                    <button
                      type="button"
                      className="kk-btn kk-btn-ghost kk-btn-sm"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(block.id, -1);
                      }}
                      title="Выше"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="kk-btn kk-btn-ghost kk-btn-sm"
                      disabled={i === blocks.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(block.id, 1);
                      }}
                      title="Ниже"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="kk-btn kk-btn-ghost kk-btn-sm"
                      style={{ color: "var(--danger)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(block.id);
                      }}
                      title="Удалить"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <BlockEditor block={block} onChange={updateBlock} botId={botId} />
              </div>
            ))}
          </div>
        )}

        {/* --- Панель действий -------------------------------------------- */}
        <div
          className="kk-card kk-pad-4 kk-row kk-gap-2"
          style={{
            position: "sticky",
            bottom: 12,
            marginTop: 20,
            alignItems: "center",
            justifyContent: "flex-end",
            background: "var(--surface, #fff)",
            zIndex: 5,
          }}
        >
          {status && (
            <div
              className="kk-xs"
              style={{
                marginRight: "auto",
                color:
                  status.kind === "ok" ? "var(--success)" : "var(--danger)",
              }}
            >
              {status.text}
            </div>
          )}
          {dirty && !status && (
            <div className="kk-xs kk-muted" style={{ marginRight: "auto" }}>
              Есть несохранённые изменения
            </div>
          )}
          <button
            type="button"
            className="kk-btn kk-btn-ghost"
            onClick={preview}
          >
            Просмотр
          </button>
          <button
            type="button"
            className="kk-btn kk-btn-accent"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
