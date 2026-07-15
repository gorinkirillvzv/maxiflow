// Каскад — агрегаты воронки по таблице leads (RLS сам ограничивает арендатором).
import { createClient } from "@/lib/supabase/server";

type LeadRow = {
  first_name: string | null;
  last_name: string | null;
  yclid: string | null;
  raw_payload: string | null;
  direct_campaign_id: string | null;
  direct_campaign_name: string | null;
  first_seen_at: string;
  subscribed_at: string | null;
  magnet_sent_at: string | null;
  conversion_status: string | null;
  conversion_sent_at: string | null;
};

export type SourceFilter = "all" | "ads" | "organic" | "campaign";
export type CampaignOption = { id: string; name: string; leads: number };

export type RecentLead = {
  name: string;
  fromAds: boolean;
  stage: "зашёл" | "подписан" | "магнит" | "конверсия";
  when: string;
  yclid: string | null;
  campaignId: string | null;
  campaignName: string | null;
};

export type TenantStats = {
  total: number;
  subscribed: number;
  magnet: number;
  fromAds: number;
  adSubscribed: number; // пришли из рекламы И подписались на канал
  conversions: number;
  pctSubscribed: number;
  pctMagnet: number;
  recent: RecentLead[];
  daily: { day: string; count: number }[];
};

export async function getCampaignOptions(): Promise<CampaignOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("direct_campaign_id, direct_campaign_name")
    .not("direct_campaign_id", "is", null)
    .limit(2000);
  const map = new Map<string, CampaignOption>();
  for (const r of data ?? []) {
    const id = r.direct_campaign_id as string;
    const name = (r.direct_campaign_name as string | null) ?? `Кампания #${id}`;
    const cur = map.get(id);
    if (cur) cur.leads += 1;
    else map.set(id, { id, name, leads: 1 });
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads);
}


function stageOf(l: LeadRow): RecentLead["stage"] {
  if (l.conversion_sent_at) return "конверсия";
  if (l.magnet_sent_at) return "магнит";
  if (l.subscribed_at) return "подписан";
  return "зашёл";
}

export async function getTenantStats(opts?: {
  source?: SourceFilter;
  campaignId?: string | null;
}): Promise<TenantStats> {
  const supabase = await createClient();
  const source = opts?.source ?? "all";
  const campaignId = opts?.campaignId ?? null;

  let q = supabase
    .from("leads")
    .select(
      "first_name,last_name,yclid,raw_payload,direct_campaign_id,direct_campaign_name,first_seen_at,subscribed_at,magnet_sent_at,conversion_status,conversion_sent_at",
    )
    .order("first_seen_at", { ascending: false });

  if (source === "ads") q = q.not("yclid", "is", null);
  if (source === "organic") q = q.is("yclid", null);
  if (source === "campaign" && campaignId) q = q.eq("direct_campaign_id", campaignId);

  const { data } = await q;
  const rows: LeadRow[] = data ?? [];

  // Тянем имена кампаний Директа отдельной выборкой и обогащаем те лиды, где имя пустое.
  // leads.direct_campaign_id хранится как string, в direct_campaigns — number, приводим в обе стороны.
  const missingNameIds = new Set(
    rows
      .filter((r) => r.direct_campaign_id && !r.direct_campaign_name)
      .map((r) => r.direct_campaign_id as string)
  );
  const campaignNames = new Map<string, string>();
  if (missingNameIds.size > 0) {
    const numericIds = [...missingNameIds].map(Number).filter((n) => !Number.isNaN(n));
    if (numericIds.length) {
      const { data: cs } = await supabase
        .from("direct_campaigns")
        .select("campaign_id, name")
        .in("campaign_id", numericIds);
      for (const c of cs ?? []) {
        campaignNames.set(String(c.campaign_id), c.name as string);
      }
    }
  }

  const total = rows.length;
  const subscribed = rows.filter((r) => r.subscribed_at).length;
  const magnet = rows.filter((r) => r.magnet_sent_at).length;
  const fromAds = rows.filter((r) => r.yclid).length;
  const adSubscribed = rows.filter((r) => r.yclid && r.subscribed_at).length;
  const conversions = rows.filter((r) => r.conversion_sent_at).length;

  const recent: RecentLead[] = rows.slice(0, 8).map((r) => ({
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Без имени",
    fromAds: !!r.yclid,
    stage: stageOf(r),
    when: r.first_seen_at,
    yclid: r.yclid,
    campaignId: r.direct_campaign_id,
    campaignName:
      r.direct_campaign_name ||
      (r.direct_campaign_id ? campaignNames.get(r.direct_campaign_id) ?? null : null),
  }));

  // подписки по дням за последние 28 дней
  const byDay = new Map<string, number>();
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const key = r.first_seen_at.slice(0, 10);
    if (byDay.has(key)) byDay.set(key, byDay.get(key)! + 1);
  }
  const daily = [...byDay.entries()].map(([day, count]) => ({ day, count }));

  return {
    total,
    subscribed,
    magnet,
    fromAds,
    adSubscribed,
    conversions,
    pctSubscribed: total ? Math.round((subscribed / total) * 100) : 0,
    pctMagnet: total ? Math.round((magnet / total) * 100) : 0,
    recent,
    daily,
  };
}
