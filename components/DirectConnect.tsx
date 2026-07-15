"use client";
// Maxiflow — подключение Директа в два шага: авторизация в Яндексе + вставка кода.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

export function DirectConnect({ authUrl }: { authUrl: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!code.trim()) { setError("Вставьте код из Яндекса"); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/direct/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка подключения");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "left", maxWidth: 360, margin: "0 auto" }}>
      <div className="kk-sm" style={{ fontWeight: 600, marginBottom: 6 }}>Шаг 1 — авторизация</div>
      <a href={authUrl} target="_blank" rel="noopener noreferrer"
        className="kk-btn kk-btn-accent" style={{ width: "100%", marginBottom: 4 }}>
        <Icon name="link" size={15} /> Открыть Яндекс
      </a>
      <div className="kk-xs kk-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        Откроется Яндекс. Разреши доступ — на странице появится код. Скопируй его.
      </div>

      <div className="kk-sm" style={{ fontWeight: 600, marginBottom: 6 }}>Шаг 2 — вставь код</div>
      <input className="kk-input" style={{ width: "100%", marginBottom: 8 }}
        value={code} onChange={(e) => setCode(e.target.value)}
        placeholder="Код подтверждения из Яндекса" />
      <button className="kk-btn kk-btn-primary" style={{ width: "100%" }}
        onClick={connect} disabled={busy}>
        {busy ? "Подключаю…" : "Подключить аккаунт Директа"}
      </button>

      {error && (
        <div className="kk-sm" style={{ marginTop: 10, color: "var(--danger)" }}>{error}</div>
      )}
    </div>
  );
}
