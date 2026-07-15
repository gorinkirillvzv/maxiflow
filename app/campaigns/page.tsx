// Maxiflow — Кампании Директа: выбор отслеживаемых кампаний, привязка к боту,
// расчёт стоимости подписчика по каждому боту.
import { Shell } from "@/components/Shell";
import { Stat } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { SyncDirectButton } from "@/components/SyncDirectButton";
import { DirectConnect } from "@/components/DirectConnect";
import { CampaignsTable, type DCampaign } from "@/components/CampaignsTable";

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

export default async function CampaignsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();
  const { data: account } = await supabase
    .from("direct_accounts")
    .select("account_login, updated_at")
    .eq("is_active", true)
    .maybeSingle();

  // --- аккаунт Директа не подключён ---
  if (!account) {
    const authUrl = `https://oauth.yandex.ru/authorize?response_type=code`
      + `&client_id=${process.env.YANDEX_OAUTH_CLIENT_ID}&force_confirm=yes`;
    return (
      <Shell active="campaigns" title="Кампании Директа" breadcrumbs={["Кампании Директа"]}>
        <div style={{ padding: "20px 24px", maxWidth: 560 }}>
          <div className="kk-card kk-pad-6" style={{ textAlign: "center" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 13, margin: "0 auto 14px",
              background: "var(--ya-yellow)", display: "grid", placeItems: "center",
            }}>
              <Icon name="yandex" size={26} stroke="#15141C" />
            </div>
            <div className="kk-h3">Подключите Яндекс Директ</div>
            <div className="kk-sm kk-muted" style={{ margin: "8px auto 18px", maxWidth: 380, lineHeight: 1.5 }}>
              Maxiflow покажет расход по кампаниям и реальную стоимость подписчика
              MAX-канала. Доступ только на чтение — кампании не изменяются.
            </div>
            <DirectConnect authUrl={authUrl} />
          </div>
        </div>
      </Shell>
    );
  }

  // --- аккаунт подключён ---
  const { data: campaigns } = await supabase
    .from("direct_campaigns")
    .select("campaign_id, name, state, impressions, clicks, cost, tracked, bot_id, synced_at")
    .order("tracked", { ascending: false })
    .order("cost", { ascending: false });
  const { data: botsRaw } = await supabase
    .from("bots").select("id, max_bot_username, channel_title");
  const { data: leadRows } = await supabase.from("leads").select("bot_id, yclid, subscribed_at");

  const rows: DCampaign[] = (campaigns ?? []).map((c) => ({
    campaign_id: c.campaign_id, name: c.name, state: c.state,
    impressions: c.impressions, clicks: c.clicks, cost: Number(c.cost),
    tracked: c.tracked, bot_id: c.bot_id,
  }));
  const bots = (botsRaw ?? []).map((b) => ({
    id: b.id, label: b.channel_title || b.max_bot_username,
  }));

  // подписчик = пришёл ИЗ РЕКЛАМЫ (yclid) И подписался на канал (subscribed_at).
  // заход в бота без подписки и органику в стоимость не включаем.
  const leadsByBot = new Map<string, number>();
  for (const l of leadRows ?? []) {
    if (l.bot_id && l.yclid && l.subscribed_at) {
      leadsByBot.set(l.bot_id, (leadsByBot.get(l.bot_id) ?? 0) + 1);
    }
  }

  const tracked = rows.filter((c) => c.tracked);
  const perBot = bots.map((b) => {
    const camps = tracked.filter((c) => c.bot_id === b.id);
    const spend = camps.reduce((s, c) => s + c.cost, 0);
    const subs = leadsByBot.get(b.id) ?? 0;
    return { ...b, count: camps.length, spend, subs, cpl: subs > 0 ? spend / subs : 0 };
  });
  const unlinked = tracked.filter((c) => !c.bot_id).length;
  const trackedSpend = tracked.reduce((s, c) => s + c.cost, 0);

  const syncedAt = campaigns?.[0]?.synced_at
    ? new Date(campaigns[0].synced_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Shell active="campaigns" title="Кампании Директа" breadcrumbs={["Кампании Директа"]}>
      <div style={{ padding: "20px 24px", maxWidth: 1000 }}>

        {sp.direct === "ok" && (
          <div className="kk-row kk-gap-2 kk-sm" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "var(--success-12)", color: "#0A7A3C" }}>
            <Icon name="check" size={15} strokeWidth={2.4} /> Аккаунт Директа подключён
          </div>
        )}

        <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div className="kk-sm kk-muted">
            Аккаунт: <b style={{ color: "var(--brand-ink)" }}>{account.account_login || "Директ"}</b>
            {syncedAt && <> · обновлено {syncedAt}</>}
          </div>
          <SyncDirectButton />
        </div>

        {/* расчёт по каждому боту */}
        {tracked.length === 0 ? (
          <div className="kk-card kk-pad-5" style={{ marginBottom: 20, background: "var(--brand-violet-12)" }}>
            <div className="kk-sm" style={{ fontWeight: 600, color: "var(--brand-violet-pressed)" }}>
              Отметьте кампании, которые ведут в MAX
            </div>
            <div className="kk-xs" style={{ marginTop: 4, color: "var(--n-600)", lineHeight: 1.5 }}>
              В таблице ниже включите тумблер «Отслеж.» у нужных кампаний и привяжите
              каждую к боту — тогда посчитаем расход и стоимость подписчика.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(perBot.length || 1, 3)}, 1fr)`, gap: 12, marginBottom: 12 }}>
              {perBot.map((b) => (
                <div key={b.id} className="kk-card kk-pad-5">
                  <div className="kk-row kk-gap-2" style={{ marginBottom: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#2E7DFF,#1EC8FF)", color: "#fff", display: "grid", placeItems: "center" }}>
                      <Icon name="max" size={13} />
                    </div>
                    <span className="kk-sm" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</span>
                  </div>
                  {b.subs > 0 ? (
                    <div className="kk-num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
                      {fmt(b.cpl)} ₽
                    </div>
                  ) : (
                    <div className="kk-sm" style={{ fontWeight: 600, color: "var(--n-400)", padding: "4px 0" }}>
                      Появится с первым подписчиком из рекламы
                    </div>
                  )}
                  <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>стоимость подписчика</div>
                  <div className="kk-divider" style={{ margin: "10px 0" }} />
                  <div className="kk-row kk-xs kk-muted" style={{ justifyContent: "space-between" }}>
                    <span>{b.count} кампаний · {fmt(b.spend)} ₽</span>
                    <span>{fmt(b.subs)} подписалось</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="kk-xs kk-muted" style={{ marginBottom: 20 }}>
              Отслеживается {tracked.length} кампаний на {fmt(trackedSpend)} ₽.
              {" "}Стоимость подписчика = расход ÷ те, кто пришёл из рекламы и подписался на канал.
              {unlinked > 0 && (
                <span style={{ color: "var(--danger)" }}> {unlinked} не привязаны к боту — выбери бота в таблице.</span>
              )}
            </div>
          </>
        )}

        {rows.length === 0 ? (
          <div className="kk-card kk-pad-6" style={{ textAlign: "center", color: "var(--n-500)" }}>
            Кампании ещё не загружены — нажмите «Обновить статистику».
          </div>
        ) : (
          <CampaignsTable campaigns={rows} bots={bots} />
        )}

        <div className="kk-xs kk-muted" style={{ marginTop: 12 }}>
          Создали новую кампанию в Директе? Нажмите «Обновить статистику» — она появится
          в таблице, отметьте её и привяжите к боту. Ранее выбранные кампании не сбрасываются.
        </div>
      </div>
    </Shell>
  );
}
