"use client";
// Каскад — форма подключения VK Pixel: pixel_id + название события.
// VK не требует OAuth, события шлются GET'ом на top-fwz1.mail.ru/tracker.
import { useState } from "react";
import { Icon } from "@/components/Icon";

export function VkPixelConnectForm() {
  const [pixelId, setPixelId] = useState("");
  const [goalName, setGoalName] = useState("magnet_delivered");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pixelOk = /^\d{4,}$/.test(pixelId.trim());
  const goalOk = /^[A-Za-z0-9_-]{2,64}$/.test(goalName.trim());

  async function save() {
    setError(null);
    if (!pixelOk) { setError("Pixel ID должен быть числом"); return; }
    if (!goalOk) { setError("Название события: только латиница, цифры, _ или -"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/vk/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixel_id: pixelId.trim(), goal_name: goalName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="kk-label">Pixel ID</label>
      <input className="kk-input" style={{ width: "100%", marginTop: 6 }}
        value={pixelId} onChange={(e) => setPixelId(e.target.value)}
        placeholder="например 3229418" inputMode="numeric" />

      <label className="kk-label" style={{ marginTop: 12 }}>Название события (GOAL_NAME)</label>
      <input className="kk-input" style={{ width: "100%", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 13 }}
        value={goalName} onChange={(e) => setGoalName(e.target.value)}
        placeholder="magnet_delivered" />
      <div className="kk-xs kk-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
        Точно то же название, что задано в VK Рекламе (Сайты → События → JS-событие).
      </div>

      {error && (
        <div className="kk-sm" style={{ marginTop: 10, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <button className="kk-btn kk-btn-accent" style={{ marginTop: 14, opacity: pixelOk && goalOk ? 1 : 0.6 }}
        onClick={save} disabled={!pixelOk || !goalOk || saving}>
        <Icon name="check" size={15} /> {saving ? "Сохраняю…" : "Подключить VK Pixel"}
      </button>
    </div>
  );
}
