"use client";
// Maxiflow — чат ИИ-поддержки (клиентский компонент)
import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/Icon";

type Msg = { role: "user" | "assistant"; content: string; needs_human?: boolean };

export function SupportChat({ initialMessages }: { initialMessages: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setMessages((m) => [...m, { role: "assistant", content: d.answer, needs_human: d.needsHuman }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <div className="kk-scroll" style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--n-500)", marginTop: 40 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--brand-violet-12)", color: "var(--brand-violet)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
              <Icon name="emoji" size={22} />
            </div>
            <div className="kk-h4" style={{ color: "var(--brand-ink)" }}>Чем помочь?</div>
            <div className="kk-sm" style={{ marginTop: 4 }}>
              Спросите о подключении MAX, Метрики, Директа или о любой проблеме с сервисом.
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="kk-row" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12, alignItems: "flex-start", gap: 8 }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand-violet)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="sparkles" size={14} />
              </div>
            )}
            <div style={{
              maxWidth: "78%", padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              background: m.role === "user" ? "var(--brand-violet)" : "var(--n-0)",
              color: m.role === "user" ? "#fff" : "var(--brand-ink)",
              boxShadow: m.role === "user" ? "none" : "var(--shadow-card)",
              borderBottomRightRadius: m.role === "user" ? 4 : 14,
              borderBottomLeftRadius: m.role === "assistant" ? 4 : 14,
            }}>
              {m.content}
              {m.needs_human && (
                <div className="kk-row kk-gap-2" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--n-100)", color: "#8A5A00", fontSize: 12 }}>
                  <Icon name="bell" size={12} stroke="var(--brand-amber)" />
                  Вопрос передан команде поддержки
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="kk-row kk-gap-2 kk-sm kk-muted" style={{ marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand-violet)", color: "#fff", display: "grid", placeItems: "center" }}>
              <Icon name="sparkles" size={14} />
            </div>
            ИИ печатает…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="kk-sm" style={{ margin: "0 24px 8px", color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div className="kk-row kk-gap-2" style={{ padding: "12px 24px 20px", borderTop: "1px solid var(--n-100)" }}>
        <input className="kk-input" style={{ flex: 1 }}
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Опишите вопрос или проблему…" disabled={sending} />
        <button className="kk-btn kk-btn-accent" onClick={send} disabled={sending || !input.trim()}
          style={{ opacity: sending || !input.trim() ? 0.6 : 1 }}>
          <Icon name="send" size={15} /> Отправить
        </button>
      </div>
    </div>
  );
}
