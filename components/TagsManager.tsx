"use client";
// Maxiflow — управление тегами арендатора: создание, переименование, цвет, удаление.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { TAG_COLORS, tagStyle } from "@/lib/tagColors";

type Tag = { id: string; name: string; color: string; leadCount: number };

function pluralLeads(n: number): string {
  const m = Math.abs(n) % 100;
  const r = m % 10;
  if (m > 10 && m < 20) return "подписчиков";
  if (r > 1 && r < 5) return "подписчика";
  if (r === 1) return "подписчик";
  return "подписчиков";
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="kk-row kk-gap-2">
      {TAG_COLORS.map((c) => (
        <button key={c} onClick={() => onChange(c)} aria-label={c} title={c} type="button"
          style={{
            width: 22, height: 22, borderRadius: 99, border: 0, cursor: "pointer",
            ...tagStyle(c),
            boxShadow: value === c ? "0 0 0 2px var(--brand-violet)" : "0 0 0 1px var(--n-200)",
          }} />
      ))}
    </div>
  );
}

export function TagsManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("violet");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eColor, setEColor] = useState("violet");

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch("/api/tags").then((r) => r.json());
    setTags(d.tags ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createTag() {
    if (!newName.trim()) return;
    setError(null);
    const r = await fetch("/api/tags", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Ошибка"); return; }
    setNewName("");
    setNewColor("violet");
    load();
  }

  async function deleteTag(id: string) {
    if (!window.confirm("Удалить тег? Он снимется со всех подписчиков.")) return;
    await fetch(`/api/tags?id=${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(t: Tag) {
    setEditingId(t.id);
    setEName(t.name);
    setEColor(t.color);
    setError(null);
  }
  async function saveEdit() {
    if (!editingId || !eName.trim()) return;
    setError(null);
    const r = await fetch("/api/tags", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, name: eName.trim(), color: eColor }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Ошибка"); return; }
    setEditingId(null);
    load();
  }

  return (
    <div>
      <div className="kk-card kk-pad-5" style={{ marginBottom: 16 }}>
        <div className="kk-h4" style={{ marginBottom: 12 }}>Создать тег</div>
        <div className="kk-row kk-gap-3" style={{ flexWrap: "wrap" }}>
          <input className="kk-input" style={{ flex: 1, minWidth: 180 }}
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Например: вебинар-октябрь" maxLength={40} />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <button className="kk-btn kk-btn-accent" onClick={createTag} disabled={!newName.trim()}>
            <Icon name="plus" size={14} /> Добавить
          </button>
        </div>
        {error && (
          <div className="kk-sm" style={{ color: "var(--danger)", marginTop: 10 }}>{error}</div>
        )}
      </div>

      <div className="kk-card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div className="kk-muted kk-sm" style={{ padding: 32, textAlign: "center" }}>Загрузка…</div>
        ) : tags.length === 0 ? (
          <div className="kk-muted kk-sm" style={{ padding: 32, textAlign: "center" }}>
            Тегов пока нет. Создайте первый сверху, а потом отмечайте им подписчиков на странице «Подписчики».
          </div>
        ) : tags.map((t, i) => (
          <div key={t.id} className="kk-row kk-gap-3" style={{
            padding: "12px 16px", borderTop: i ? "1px solid var(--n-100)" : 0, flexWrap: "wrap",
          }}>
            {editingId === t.id ? (
              <>
                <input className="kk-input kk-btn-sm" style={{ flex: 1, minWidth: 160 }}
                  value={eName} onChange={(e) => setEName(e.target.value)} maxLength={40} />
                <ColorPicker value={eColor} onChange={setEColor} />
                <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={saveEdit}>Сохранить</button>
                <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => setEditingId(null)}>Отмена</button>
              </>
            ) : (
              <>
                <span className="kk-chip" style={{ ...tagStyle(t.color), height: 24, fontSize: 12.5, fontWeight: 600 }}>
                  {t.name}
                </span>
                <span style={{ flex: 1 }} />
                <span className="kk-xs kk-muted">{t.leadCount} {pluralLeads(t.leadCount)}</span>
                <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon" onClick={() => startEdit(t)} title="Редактировать">
                  <Icon name="edit" size={13} />
                </button>
                <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon" style={{ color: "var(--danger)" }}
                  onClick={() => deleteTag(t.id)} title="Удалить">
                  <Icon name="trash" size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
