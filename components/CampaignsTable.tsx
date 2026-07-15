"use client";
// Maxiflow — таблица кампаний Директа: выбор отслеживаемых + привязка к боту.
import { useState } from "react";
import { useRouter } from "next/navigation";

export type DCampaign = {
  campaign_id: number;
  name: string | null;
  state: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  tracked: boolean;
  bot_id: string | null;
};
type Bot = { id: string; label: string };

const STATE_RU: Record<string, { label: string; cls: string }> = {
  ON:        { label: "Активна",        cls: "kk-chip-green" },
  OFF:       { label: "Остановлена",    cls: "" },
  SUSPENDED: { label: "Приостановлена", cls: "kk-chip-amber" },
  ENDED:     { label: "Завершена",      cls: "" },
  CONVERTED: { label: "Сконвертирована", cls: "" },
};
const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

export function CampaignsTable({ campaigns, bots }: { campaigns: DCampaign[]; bots: Bot[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

  async function patch(campaignId: number, body: Record<string, unknown>) {
    setPending(campaignId);
    try {
      const r = await fetch("/api/direct/campaign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, ...body }),
      });
      if (r.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  const visible = campaigns.filter(
    (c) => showAll || c.cost > 0 || c.tracked || c.state === "ON",
  );
  const hidden = campaigns.length - visible.length;

  return (
    <div className="kk-card" style={{ overflow: "hidden" }}>
      <div className="kk-row" style={{ padding: "12px 16px", borderBottom: "1px solid var(--n-100)", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div className="kk-sm" style={{ fontWeight: 600 }}>
          Кампании · отметь нужные и привяжи к боту
        </div>
        <label className="kk-row kk-gap-2 kk-sm kk-muted" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Показать все ({campaigns.length})
        </label>
      </div>

      <div className="kk-scroll" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 760 }}>
          <div className="kk-row" style={{ padding: "8px 16px", borderBottom: "1px solid var(--n-100)", fontSize: 11, fontWeight: 600, color: "var(--n-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <div style={{ flex: "2 1 0", minWidth: 180 }}>Кампания</div>
            <div style={{ flex: "1 1 0", minWidth: 110 }}>Статус</div>
            <div style={{ flex: "0 0 90px", textAlign: "right" }}>Клики</div>
            <div style={{ flex: "0 0 100px", textAlign: "right" }}>Расход</div>
            <div style={{ flex: "0 0 96px", textAlign: "center" }}>Отслеж.</div>
            <div style={{ flex: "1 1 0", minWidth: 150 }}>Бот</div>
          </div>

          {visible.length === 0 ? (
            <div className="kk-muted kk-sm" style={{ padding: 32, textAlign: "center" }}>
              Нет кампаний — нажмите «Обновить статистику».
            </div>
          ) : visible.map((c) => {
            const st = STATE_RU[c.state ?? ""] ?? { label: c.state ?? "—", cls: "" };
            const busy = pending === c.campaign_id;
            return (
              <div key={c.campaign_id} className="kk-row" style={{
                padding: "10px 16px", borderBottom: "1px solid var(--n-50)", fontSize: 13,
                opacity: busy ? 0.5 : 1,
              }}>
                <div style={{ flex: "2 1 0", minWidth: 180, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name || `Кампания ${c.campaign_id}`}
                </div>
                <div style={{ flex: "1 1 0", minWidth: 110 }}>
                  <span className={`kk-chip ${st.cls}`} style={{ height: 22 }}>{st.label}</span>
                </div>
                <div className="kk-num" style={{ flex: "0 0 90px", textAlign: "right" }}>{fmt(c.clicks)}</div>
                <div className="kk-num" style={{ flex: "0 0 100px", textAlign: "right", fontWeight: 600 }}>{fmt(c.cost)} ₽</div>
                <div style={{ flex: "0 0 96px", display: "flex", justifyContent: "center" }}>
                  <button onClick={() => patch(c.campaign_id, { tracked: !c.tracked })}
                    disabled={busy}
                    style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                    <div style={{ width: 34, height: 20, borderRadius: 99, background: c.tracked ? "var(--brand-violet)" : "var(--n-200)", position: "relative", transition: "background 0.15s" }}>
                      <div style={{ position: "absolute", top: 2, left: c.tracked ? 16 : 2, width: 16, height: 16, borderRadius: 99, background: "#fff", transition: "left 0.15s" }} />
                    </div>
                  </button>
                </div>
                <div style={{ flex: "1 1 0", minWidth: 150 }}>
                  <select className="kk-input kk-btn-sm" style={{ width: "100%" }}
                    value={c.bot_id ?? ""}
                    disabled={busy}
                    onChange={(e) => patch(c.campaign_id, { bot_id: e.target.value })}>
                    <option value="">— не привязана —</option>
                    {bots.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hidden > 0 && (
        <div className="kk-row" style={{ padding: "10px 16px", borderTop: "1px solid var(--n-100)", color: "var(--n-500)", fontSize: 12 }}>
          Скрыто {hidden} кампаний без расхода — включите «Показать все», чтобы выбрать их.
        </div>
      )}
    </div>
  );
}
