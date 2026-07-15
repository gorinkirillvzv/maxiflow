// Maxiflow — Подписчики: лиды бота с фильтрами и тегами. Данные из таблицы leads (RLS).
import { Shell } from "@/components/Shell";
import { Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { SubscribersTable, type SubLead, type TagDef } from "@/components/SubscribersTable";

export default async function SubscribersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, max_user_id, max_username, first_name, last_name, yclid, utm_campaign, direct_campaign_id, direct_campaign_name, first_seen_at, subscribed_at, magnet_sent_at, unsubscribed_at, unsubscribed_reason, conversion_status, conversion_sent_at")
    .order("first_seen_at", { ascending: false })
    .limit(1000);
  const leads: SubLead[] = data ?? [];

  const { data: tagsData } = await supabase.from("tags").select("id, name, color");
  const tags: TagDef[] = tagsData ?? [];

  const { data: ltRows } = await supabase.from("lead_tags").select("lead_id, tag_id");
  const leadTagMap: Record<string, string[]> = {};
  for (const lt of ltRows ?? []) {
    (leadTagMap[lt.lead_id] ??= []).push(lt.tag_id);
  }

  const total = leads.length;
  const subscribed = leads.filter((l) => l.subscribed_at && !l.unsubscribed_at).length;
  const unsubscribed = leads.filter((l) => l.unsubscribed_at).length;
  const fromAds = leads.filter((l) => l.yclid).length;
  const conversions = leads.filter((l) => l.conversion_sent_at).length;

  return (
    <Shell active="subscribers" title="Подписчики" breadcrumbs={["Аудитория", "Подписчики"]}>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
          <Stat label="Всего" value={total} icon="users" accent="violet" />
          <Stat label="Подписаны" value={subscribed} icon="check" accent="green" />
          <Stat label="Отписались" value={unsubscribed} icon="close" accent="coral" />
          <Stat label="С рекламы" value={fromAds} icon="yandex" accent="amber" />
          <Stat label="Конверсии" value={conversions} icon="trend_up" accent="green" />
        </div>
        <SubscribersTable leads={leads} tags={tags} leadTagMap={leadTagMap} />
      </div>
    </Shell>
  );
}
