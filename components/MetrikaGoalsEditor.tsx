"use client";
// Редактор имён двух целей Метрики: подписка на канал и магнит.
// Имена должны точно совпадать с идентификатором JS-цели в Метрике.
import { useState } from "react";
import { Icon } from "@/components/Icon";

const goalOk = (s: string) => s === "" || /^[A-Za-z0-9_-]{2,64}$/.test(s.trim());

export function MetrikaGoalsEditor({
  counterId,
  initialMagnetGoal,
  initialSubscribedGoal,
}: {
  counterId: number;
  initialMagnetGoal: string;
  initialSubscribedGoal: string;
}) {
  const [magnet, setMagnet] = useState(initialMagnetGoal);
  const [subscribed, setSubscribed] = useState(initialSubscribedGoal);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!goalOk(magnet)) { setError("Цель «магнит»: латиница/цифры/_-"); return; }
    if (!goalOk(subscribed)) { setError("Цель «подписка»: латиница/цифры/_-"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/metrika/goals", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_name: magnet.trim(),
          subscribed_goal_name: subscribed.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setEdit(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (!edit) {
    return (
      <div className="kk-col kk-gap-2">
        <div className="kk-row kk-gap-2 kk-sm" style={{ alignItems: "center" }}>
          <span className="kk-chip" style={{ background: "#FFEDD5", color: "#9A3412", height: 22 }}>магнит</span>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--n-0)", padding: "2px 6px", borderRadius: 5 }}>
            {magnet || "—"}
          </code>
        </div>
        <div className="kk-row kk-gap-2 kk-sm" style={{ alignItems: "center" }}>
          <span className="kk-chip" style={{ background: "#DBEAFE", color: "#1E40AF", height: 22 }}>подписка</span>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--n-0)", padding: "2px 6px", borderRadius: 5 }}>
            {subscribed || "не настроена"}
          </code>
        </div>
        <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ alignSelf: "flex-start" }}
          onClick={() => setEdit(true)}>
          <Icon name="settings_h" size={12} /> Изменить
        </button>
      </div>
    );
  }

  return (
    <div className="kk-col kk-gap-2" style={{ padding: 8, background: "var(--n-0)", borderRadius: 8 }}>
      <label className="kk-label">Цель «получил магнит»</label>
      <input className="kk-input kk-btn-sm" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
        value={magnet} onChange={(e) => setMagnet(e.target.value)}
        placeholder="magnet_delivered" />

      <label className="kk-label" style={{ marginTop: 8 }}>Цель «подписался на канал»</label>
      <input className="kk-input kk-btn-sm" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
        value={subscribed} onChange={(e) => setSubscribed(e.target.value)}
        placeholder="channel_subscribed (оставь пустым если не нужно)" />

      <div className="kk-xs kk-muted" style={{ lineHeight: 1.5 }}>
        Имя должно ТОЧНО совпадать с идентификатором JS-цели в Метрике.
        Создай две цели типа «JavaScript-событие» в счётчике {counterId} с этими именами.
      </div>

      {error && (
        <div className="kk-xs" style={{ color: "var(--danger)" }}>{error}</div>
      )}

      <div className="kk-row kk-gap-2" style={{ marginTop: 4 }}>
        <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={save} disabled={saving}>
          {saving ? "..." : "Сохранить"}
        </button>
        <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => {
          setEdit(false); setMagnet(initialMagnetGoal); setSubscribed(initialSubscribedGoal); setError(null);
        }}>Отмена</button>
      </div>
    </div>
  );
}
