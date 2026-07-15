"use client";
// Maxiflow — кнопка обновления статистики кампаний Директа.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

export function SyncDirectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/direct/sync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      if (d.statsError) {
        setError(`Кампании загружены, но статистика не подтянулась: ${d.statsError}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kk-row kk-gap-3" style={{ flexWrap: "wrap" }}>
      <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={sync} disabled={busy}>
        <Icon name="download" size={13} /> {busy ? "Обновляю…" : "Обновить статистику"}
      </button>
      {error && <span className="kk-sm" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
