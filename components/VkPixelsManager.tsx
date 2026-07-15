"use client";
// Каскад — менеджер VK-пикселей: список + добавить + редактировать + удалить.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Pixel = {
  id: string;
  pixel_id: string;
  goal_name: string;
  label: string | null;
};

type EditState = { id: string; pixel_id: string; goal_name: string; label: string };

const isPixelOk = (s: string) => /^\d{4,}$/.test(s.trim());
const isGoalOk = (s: string) => /^[A-Za-z0-9_-]{2,64}$/.test(s.trim());

export function VkPixelsManager() {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);

  // форма добавления
  const [newPixel, setNewPixel] = useState("");
  const [newGoal, setNewGoal] = useState("magnet_delivered");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/vk/config");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setPixels(d.pixels ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function addPixel() {
    setError(null);
    if (!isPixelOk(newPixel)) { setError("Pixel ID — только число"); return; }
    if (!isGoalOk(newGoal)) { setError("Имя события: латиница/цифры/_-"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/vk/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixel_id: newPixel.trim(), goal_name: newGoal.trim(), label: newLabel.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setNewPixel(""); setNewGoal("magnet_delivered"); setNewLabel("");
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setError(null);
    if (!isPixelOk(editing.pixel_id)) { setError("Pixel ID — только число"); return; }
    if (!isGoalOk(editing.goal_name)) { setError("Имя события: латиница/цифры/_-"); return; }
    try {
      const r = await fetch("/api/vk/config", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          pixel_id: editing.pixel_id.trim(),
          goal_name: editing.goal_name.trim(),
          label: editing.label.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function remove(p: Pixel) {
    if (!confirm(`Удалить пиксель ${p.label || p.pixel_id}? Конверсии в него перестанут отправляться.`)) return;
    const r = await fetch(`/api/vk/config?id=${p.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Ошибка"); return; }
    await load();
  }

  return (
    <div>
      {error && (
        <div className="kk-sm" style={{ marginBottom: 10, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="kk-sm kk-muted">Загружаю…</div>
      ) : pixels.length === 0 && !adding ? (
        <div className="kk-card kk-pad-4 kk-sm kk-muted" style={{ textAlign: "center" }}>
          Пикселей пока нет. Добавь первый, чтобы Каскад начал слать конверсии в VK Рекламу.
        </div>
      ) : (
        <div className="kk-col kk-gap-2">
          {pixels.map((p) => {
            const isEdit = editing?.id === p.id;
            return (
              <div key={p.id} className="kk-card kk-pad-3" style={{ background: isEdit ? "var(--brand-violet-12)" : "var(--n-25)" }}>
                {isEdit ? (
                  <div className="kk-col kk-gap-2">
                    <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                      <input className="kk-input kk-btn-sm" style={{ flex: 1, minWidth: 140 }}
                        placeholder="Название (например «VK главный»)"
                        value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
                    </div>
                    <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                      <input className="kk-input kk-btn-sm" style={{ width: 160, fontFamily: "var(--font-mono)" }}
                        placeholder="Pixel ID" value={editing.pixel_id}
                        onChange={(e) => setEditing({ ...editing, pixel_id: e.target.value })} />
                      <input className="kk-input kk-btn-sm" style={{ flex: 1, minWidth: 160, fontFamily: "var(--font-mono)" }}
                        placeholder="GOAL_NAME" value={editing.goal_name}
                        onChange={(e) => setEditing({ ...editing, goal_name: e.target.value })} />
                    </div>
                    <div className="kk-row kk-gap-2">
                      <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={saveEdit}>Сохранить</button>
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => setEditing(null)}>Отмена</button>
                    </div>
                  </div>
                ) : (
                  <div className="kk-row kk-gap-3" style={{ alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#0077FF,#0044BB)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                      VK
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="kk-sm" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.label || `Пиксель ${p.pixel_id}`}
                      </div>
                      <div className="kk-xs kk-muted" style={{ fontFamily: "var(--font-mono)" }}>
                        ID <b>{p.pixel_id}</b> · событие <b>{p.goal_name}</b>
                      </div>
                    </div>
                    <button className="kk-btn kk-btn-ghost kk-btn-sm"
                      onClick={() => setEditing({ id: p.id, pixel_id: p.pixel_id, goal_name: p.goal_name, label: p.label ?? "" })}>
                      Изменить
                    </button>
                    <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }}
                      onClick={() => remove(p)}>
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="kk-card kk-pad-4" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Новый VK-пиксель</div>
          <label className="kk-label">Название (необязательно)</label>
          <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 10 }}
            value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            placeholder="например «VK главный»" />

          <label className="kk-label">Pixel ID</label>
          <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 10 }}
            value={newPixel} onChange={(e) => setNewPixel(e.target.value)}
            placeholder="например 3229418" inputMode="numeric" />

          <label className="kk-label">Название события (GOAL_NAME)</label>
          <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 10, fontFamily: "var(--font-mono)", fontSize: 13 }}
            value={newGoal} onChange={(e) => setNewGoal(e.target.value)}
            placeholder="magnet_delivered" />

          <div className="kk-row kk-gap-2">
            <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={addPixel}
              disabled={saving || !isPixelOk(newPixel) || !isGoalOk(newGoal)}
              style={{ opacity: saving || !isPixelOk(newPixel) || !isGoalOk(newGoal) ? 0.6 : 1 }}>
              {saving ? "Сохраняю…" : "Добавить"}
            </button>
            <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => setAdding(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className="kk-btn kk-btn-outline kk-btn-sm" style={{ marginTop: 12 }}
          onClick={() => setAdding(true)}>
          <Icon name="plus" size={12} /> Добавить пиксель
        </button>
      )}
    </div>
  );
}
