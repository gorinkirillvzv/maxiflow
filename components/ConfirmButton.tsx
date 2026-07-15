"use client";
import { useState } from "react";

export function ConfirmButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function confirm() {
    setLoading(true);
    try {
      const r = await fetch("/api/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (!r.ok) {
        setResult({ ok: false, msg: d.error || "Ошибка" });
      } else {
        setResult({ ok: true, msg: "Готово. Действие выполнено." });
        setTimeout(() => { location.href = "/dashboard"; }, 1500);
      }
    } catch {
      setResult({ ok: false, msg: "Сеть недоступна" });
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="kk-sm" style={{
        padding: "10px 14px", borderRadius: 10,
        background: result.ok ? "var(--success-12)" : "var(--brand-coral-12)",
        color: result.ok ? "#0A7A3C" : "#B12E1A",
      }}>{result.msg}</div>
    );
  }
  return (
    <button className="kk-btn kk-btn-accent kk-btn-lg" onClick={confirm} disabled={loading}
      style={{ minWidth: 200, opacity: loading ? 0.6 : 1 }}>
      {loading ? "Выполняю…" : "Подтвердить"}
    </button>
  );
}
