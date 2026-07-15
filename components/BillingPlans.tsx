"use client";
// Maxiflow — карточки тарифов с переключателем месяц/год и оформлением оплаты.
import { useState } from "react";
import { Icon } from "./Icon";
import { PLANS, PAID_PLANS, type PlanId, type BillingPeriod } from "@/lib/billing";

const ORDER: PlanId[] = ["trial", "start", "business", "scale"];

const FEATURES: Record<PlanId, string[]> = {
  trial: ["До 50 подписчиков бота", "1 канал", "3 воронки и 3 лид-магнита", "Рассылки, конверсии в Метрику"],
  start: ["До 1 000 подписчиков бота", "1 канал", "Воронки и магниты без лимита", "Онлайн-чат, конверсии в Метрику"],
  business: ["До 5 000 подписчиков бота", "3 канала", "Всё из «Старт»", "A/B-тесты", "Приоритетная поддержка"],
  scale: ["До 20 000 подписчиков бота", "Каналы без лимита", "Всё из «Бизнес»", "Личный менеджер"],
};

const fmt = (n: number) => n.toLocaleString("ru-RU");

export function BillingPlans({ currentPlan }: { currentPlan: PlanId }) {
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: PlanId) {
    setBusy(plan);
    setError(null);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка оформления");
      if (d.paymentUrl) {
        window.location.href = d.paymentUrl;
        return;
      }
      throw new Error("Не получена ссылка на оплату");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(null);
    }
  }

  return (
    <div>
      {/* переключатель периода */}
      <div className="kk-row" style={{ justifyContent: "center", marginBottom: 20 }}>
        <div className="kk-tabs">
          <button className="kk-tab" data-active={period === "month"} onClick={() => setPeriod("month")}>
            Помесячно
          </button>
          <button className="kk-tab" data-active={period === "year"} onClick={() => setPeriod("year")}>
            За год · −20%
          </button>
        </div>
      </div>

      {error && (
        <div className="kk-sm" style={{ marginBottom: 14, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "10px 14px", borderRadius: 10, textAlign: "center" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === currentPlan;
          const paid = PAID_PLANS.includes(id);
          const price = period === "year" ? p.priceYear : p.priceMonth;
          const highlight = id === "business";
          return (
            <div key={id} className="kk-card" style={{
              padding: 20, display: "flex", flexDirection: "column", gap: 4,
              border: highlight ? "2px solid var(--brand-violet)" : "1px solid var(--n-100)",
              position: "relative",
            }}>
              {highlight && (
                <span className="kk-chip kk-chip-violet" style={{
                  position: "absolute", top: -11, left: 20, height: 22, fontSize: 11, fontWeight: 600,
                }}>Популярный</span>
              )}
              <div className="kk-h4">{p.name}</div>
              <div className="kk-xs kk-muted" style={{ minHeight: 32 }}>{p.tagline}</div>

              <div style={{ margin: "6px 0 10px" }}>
                {paid ? (
                  <>
                    <span className="kk-num" style={{ fontSize: 26, fontWeight: 700 }}>{fmt(price)} ₽</span>
                    <span className="kk-sm kk-muted"> / {period === "year" ? "год" : "мес"}</span>
                    {period === "year" && (
                      <div className="kk-xs kk-muted">≈ {fmt(Math.round(price / 12))} ₽/мес</div>
                    )}
                  </>
                ) : (
                  <span className="kk-num" style={{ fontSize: 26, fontWeight: 700 }}>Бесплатно</span>
                )}
              </div>

              <div className="kk-col kk-gap-2" style={{ flex: 1, marginBottom: 14 }}>
                {FEATURES[id].map((f) => (
                  <div key={f} className="kk-row kk-gap-2 kk-xs">
                    <Icon name="check" size={13} stroke="var(--success)" strokeWidth={2.4} />
                    <span style={{ flex: 1 }}>{f}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <button className="kk-btn kk-btn-soft" disabled style={{ width: "100%" }}>
                  Ваш тариф
                </button>
              ) : paid ? (
                <button className={`kk-btn ${highlight ? "kk-btn-accent" : "kk-btn-outline"}`}
                  style={{ width: "100%" }}
                  disabled={busy !== null}
                  onClick={() => checkout(id)}>
                  {busy === id ? "Создаю оплату…" : "Оформить"}
                </button>
              ) : (
                <button className="kk-btn kk-btn-soft" disabled style={{ width: "100%" }}>
                  Стартовый
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
