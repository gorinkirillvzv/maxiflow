"use client";
// Фильтр источника трафика на дашборде. Меняет URL searchParams,
// серверный page пересобирается с новыми данными.
import { useRouter, useSearchParams } from "next/navigation";
import type { SourceFilter, CampaignOption } from "@/lib/analytics";

const SOURCE_LABELS: { id: SourceFilter; label: string }[] = [
  { id: "all",     label: "Все источники" },
  { id: "ads",     label: "Только реклама" },
  { id: "organic", label: "Органика" },
  { id: "campaign",label: "Кампания…" },
];

export function SourceFilterBar({
  source, campaignId, campaigns,
}: {
  source: SourceFilter;
  campaignId: string | null;
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(name: string, val: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (val) next.set(name, val);
    else next.delete(name);
    router.push(`/dashboard?${next.toString()}`);
  }

  function selectSource(s: SourceFilter) {
    if (s === source) return;
    const next = new URLSearchParams(sp.toString());
    next.set("source", s);
    if (s !== "campaign") next.delete("campaign");
    else if (campaigns[0]) next.set("campaign", campaigns[0].id);
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="kk-card kk-row kk-gap-3" style={{
      padding: "10px 14px", marginBottom: 16, flexWrap: "wrap", alignItems: "center",
    }}>
      <div className="kk-xs kk-muted" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Источник
      </div>
      <div className="kk-tabs">
        {SOURCE_LABELS.map((s) => (
          <button key={s.id} className="kk-tab" data-active={source === s.id}
            onClick={() => selectSource(s.id)}>{s.label}</button>
        ))}
      </div>
      {source === "campaign" && (
        campaigns.length === 0 ? (
          <div className="kk-xs kk-muted">
            Нет данных по кампаниям. Добавь <code>_c_{"{campaign_id}"}</code> в ссылку Директа.
          </div>
        ) : (
          <select className="kk-input kk-btn-sm" style={{ minWidth: 200 }}
            value={campaignId ?? campaigns[0].id}
            onChange={(e) => setParam("campaign", e.target.value)}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.leads})</option>
            ))}
          </select>
        )
      )}
    </div>
  );
}
