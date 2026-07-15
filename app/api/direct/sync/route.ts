// Maxiflow — синхронизация кампаний Директа.
// Источник списка — ОТЧЁТ (видит все кампании, включая новые типы);
// campaigns.get добавляет статусы для классических кампаний.
// Upsert сохраняет выбор пользователя (tracked, bot_id).
import { createClient } from "@/lib/supabase/server";
import { directGetCampaigns, directGetCampaignStats, DirectError } from "@/lib/directApi";
import { maybeDecrypt } from "@/lib/crypto";

type Row = {
  tenant_id: string;
  campaign_id: number;
  name: string;
  type: string | null;
  state: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  period: string;
  synced_at: string;
};

function errText(e: unknown): string {
  if (e instanceof DirectError) return `код ${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : "ошибка";
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return Response.json({ error: "Нет рабочего пространства" }, { status: 400 });

  const { data: acc } = await supabase
    .from("direct_accounts")
    .select("oauth_token")
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!acc) return Response.json({ error: "Директ не подключён" }, { status: 400 });
  const accessToken = maybeDecrypt(acc.oauth_token);
  if (!accessToken) return Response.json({ error: "Токен Директа недоступен" }, { status: 500 });

  const now = new Date().toISOString();
  const merged = new Map<number, Row>();

  // 1) campaigns.get — статусы (возвращает только классические TEXT_CAMPAIGN)
  let getErr: string | null = null;
  try {
    for (const c of await directGetCampaigns(accessToken)) {
      merged.set(c.Id, {
        tenant_id: tenant.id, campaign_id: c.Id, name: c.Name,
        type: c.Type ?? null, state: c.State ?? null,
        impressions: 0, clicks: 0, cost: 0, period: "LAST_30_DAYS", synced_at: now,
      });
    }
  } catch (e) {
    getErr = errText(e);
  }

  // 2) отчёт — все кампании с активностью за 30 дней (в т.ч. новые типы)
  let repErr: string | null = null;
  try {
    for (const s of await directGetCampaignStats(accessToken)) {
      const ex = merged.get(s.campaignId);
      if (ex) {
        ex.impressions = s.impressions;
        ex.clicks = s.clicks;
        ex.cost = s.cost;
        if (!ex.type && s.type) ex.type = s.type;
      } else {
        merged.set(s.campaignId, {
          tenant_id: tenant.id, campaign_id: s.campaignId,
          name: s.name || `Кампания ${s.campaignId}`,
          type: s.type || null, state: null,
          impressions: s.impressions, clicks: s.clicks, cost: s.cost,
          period: "LAST_30_DAYS", synced_at: now,
        });
      }
    }
  } catch (e) {
    repErr = errText(e);
  }

  if (getErr && repErr) {
    return Response.json({ error: `Директ недоступен: ${repErr}` }, { status: 502 });
  }

  const rows = [...merged.values()];
  if (rows.length) {
    const { error } = await supabase
      .from("direct_campaigns")
      .upsert(rows, { onConflict: "tenant_id,campaign_id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // чистим устаревшие НЕотслеживаемые кампании; tracked сохраняем
  const ids = [...merged.keys()];
  let del = supabase.from("direct_campaigns")
    .delete().eq("tenant_id", tenant.id).eq("tracked", false);
  if (ids.length) del = del.not("campaign_id", "in", `(${ids.join(",")})`);
  await del;

  const statsError = repErr
    ? `Статистика загрузилась не полностью (${repErr})`
    : getErr
      ? `Статусы кампаний не загрузились (${getErr})`
      : null;
  return Response.json({ ok: true, count: rows.length, statsError });
}
