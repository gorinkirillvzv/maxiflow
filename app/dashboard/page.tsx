// Каскад — Дашборд (redesign 2026-07):
// • KPI-плитки с sparkline и delta 7д к предыдущим 7д.
// • Последние подписчики + последние рассылки.
// • Пустое состояние — hero «Подключите бота MAX».
// • Полезное со старого дашборда сохранено: чек-лист онбординга, trial-баннер,
//   фильтр источника, график динамики, donut «реклама/органика», таблица кампаний Директа.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle, Avatar } from "@/components/ui";
import { getTenantStats, getCampaignOptions, type SourceFilter } from "@/lib/analytics";
import { SourceFilterBar } from "@/components/SourceFilterBar";
import { createClient } from "@/lib/supabase/server";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { TrialBanner } from "@/components/TrialBanner";
import { trialDaysLeft, type Subscription } from "@/lib/billing";

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

const STAGE_CLS: Record<string, string> = {
  "зашёл": "",
  "подписан": "kk-chip-green",
  "магнит": "kk-chip-amber",
  "конверсия": "kk-chip-violet",
};
const AV = ["#5B47FB", "#FFB020", "#00B956", "#FF6B57", "#2E7DFF", "#7C5CFF", "#E5484D", "#9333EA"];

function relTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}
function dayLabel(d: string): string {
  const [, mo, da] = d.split("-");
  return `${da}.${mo}`;
}

/* ===== KPI Sparkline (7 точек, без библиотек) ===== */
function KpiSparkline({ values, tone }: { values: number[]; tone: "violet" | "green" | "amber" | "coral" | "muted" }) {
  if (!values.length) return null;
  const stroke = {
    violet: "var(--brand-violet)",
    green: "var(--success)",
    amber: "var(--brand-amber)",
    coral: "var(--brand-coral)",
    muted: "var(--n-300)",
  }[tone];
  const W = 140, H = 32;
  const max = Math.max(1, ...values);
  const n = Math.max(1, values.length - 1);
  const step = W / n;
  const pts = values.map((v, i) => [i * step, H - (v / max) * (H - 6) - 3] as const);
  const path = "M " + pts.map((p) => p.join(" ")).join(" L ");
  const area = path + ` L ${W} ${H} L 0 ${H} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible", height: 32 }}>
      <path d={area} fill={stroke} opacity="0.14" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.4" fill={stroke} />}
    </svg>
  );
}

/* ===== KPI Tile ===== */
function KpiTile({ label, value, delta, sparkline, tone, empty }: {
  label: string;
  value: string;
  delta: { pct: number; positiveIsGood: boolean } | null;
  sparkline?: number[];
  tone: "violet" | "green" | "amber" | "coral";
  empty: boolean;
}) {
  const rounded = delta ? Math.round(delta.pct) : 0;
  const showDelta = !!delta && Math.abs(rounded) >= 1 && !empty;
  const positive = rounded > 0;
  const isGood = positive === delta?.positiveIsGood;
  const dColor = isGood ? "var(--success-fg)" : "var(--danger-fg)";
  const dBg = isGood ? "var(--success-12)" : "var(--danger-12)";
  const arrow = positive ? "▲" : "▼";

  return (
    <div className="kk-card kk-card-hover" style={{
      padding: "var(--s-5)",
      display: "flex", flexDirection: "column", gap: 14, minWidth: 0,
    }}>
      <div className="kk-row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--n-500)", lineHeight: 1.3,
        }}>{label}</span>
        {showDelta && (
          <span className="kk-num" style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11.5, fontWeight: 700, padding: "2px 7px",
            borderRadius: "var(--r-full)", background: dBg, color: dColor,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 9 }}>{arrow}</span>
            {Math.abs(rounded)}%
          </span>
        )}
      </div>
      <div className="kk-num" style={{
        fontFamily: "var(--font-display)",
        fontSize: "var(--fs-h1)",
        lineHeight: 1,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: empty ? "var(--n-400)" : "var(--brand-ink)",
      }}>
        {value}
      </div>
      <div style={{ marginTop: "auto" }}>
        {sparkline && sparkline.some((v) => v > 0) ? (
          <KpiSparkline values={sparkline} tone={empty ? "muted" : tone} />
        ) : (
          <div style={{ height: 32, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", borderBottom: "1px dashed var(--n-200)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Chart (динамика подписчиков) ===== */
function ChartCard({ daily }: { daily: { day: string; count: number }[] }) {
  const W = 720, H = 240, padX = 30, padY = 20;
  const n = daily.length || 1;
  const xs = (i: number) => padX + (i / Math.max(n - 1, 1)) * (W - padX * 2);
  const maxV = Math.max(1, ...daily.map((d) => d.count)) * 1.15;
  const ys = (v: number) => H - padY - (v / maxV) * (H - padY * 2);
  const pts = daily.map((d, i) => `${xs(i)} ${ys(d.count)}`);
  const path = "M " + pts.join(" L ");
  const area = path + ` L ${xs(n - 1)} ${H - padY} L ${xs(0)} ${H - padY} Z`;
  const ticks = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((n * 3) / 4), n - 1];

  return (
    <div className="kk-card kk-card-hover" style={{ padding: "var(--s-5)" }}>
      <SectionTitle sub="входы в бота за последние 28 дней">
        Динамика подписчиков
      </SectionTitle>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="grad-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-violet)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--brand-violet)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={padX} y1={padY + (H - padY * 2) * t} x2={W - padX} y2={padY + (H - padY * 2) * t} stroke="var(--n-100)" strokeDasharray="3 3" />
        ))}
        <path d={area} fill="url(#grad-a)" />
        <path d={path} fill="none" stroke="var(--brand-violet)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {n > 0 && <circle cx={xs(n - 1)} cy={ys(daily[n - 1].count)} r="5" fill="var(--n-0)" stroke="var(--brand-violet)" strokeWidth="2.5" />}
        {ticks.map((i) => (
          <text key={i} x={xs(i)} y={H - 2} fontSize="10" textAnchor="middle" fill="var(--n-400)">
            {daily[i] ? dayLabel(daily[i].day) : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ===== Donut (реклама vs органика) ===== */
function Donut({ size = 140, data, total }: {
  size?: number; data: { value: number; color: string }[]; total: number;
}) {
  const c = size / 2, r = (size - 20) / 2;
  let acc = 0;
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--n-100)" strokeWidth="14" />
      {total > 0 && data.map((d, i) => {
        const start = acc, end = acc + d.value;
        acc = end;
        if (d.value <= 0) return null;
        const sa = (start / total) * 360 - 90;
        const ea = (end / total) * 360 - 90;
        const x1 = c + r * Math.cos((sa * Math.PI) / 180);
        const y1 = c + r * Math.sin((sa * Math.PI) / 180);
        const x2 = c + r * Math.cos((ea * Math.PI) / 180);
        const y2 = c + r * Math.sin((ea * Math.PI) / 180);
        const large = end - start > total / 2 ? 1 : 0;
        return (
          <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
            fill="none" stroke={d.color} strokeWidth="14" strokeLinecap="round" />
        );
      })}
      <text x={c} y={c - 2} textAnchor="middle" fontWeight="700" fontSize="22" fill="var(--brand-ink)"
        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(total)}</text>
      <text x={c} y={c + 16} textAnchor="middle" fontSize="11" fill="var(--n-500)">подписчиков</text>
    </svg>
  );
}

/* ===== Broadcast status chip ===== */
function BroadcastStatus({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    done:     { label: "готово",       cls: "kk-chip-green" },
    sending:  { label: "отправляется", cls: "kk-chip-violet" },
    queued:   { label: "в очереди",    cls: "kk-chip-amber" },
    failed:   { label: "ошибка",       cls: "kk-chip-coral" },
    draft:    { label: "черновик",     cls: "" },
  };
  const it = map[status ?? ""] ?? { label: status ?? "—", cls: "" };
  return (
    <span className={`kk-chip ${it.cls}`} style={{ height: 20, fontSize: 10.5, padding: "0 7px", flexShrink: 0 }}>
      {it.label}
    </span>
  );
}

/* ===== Empty state hero ===== */
function EmptyStateHero() {
  return (
    <div className="kk-card" style={{
      padding: "var(--s-8) var(--s-6)",
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", gap: 14, margin: "40px auto 0", maxWidth: 640,
    }}>
      <div style={{
        width: 68, height: 68, borderRadius: 20,
        background: "var(--brand-violet-12)", color: "var(--brand-violet)",
        display: "grid", placeItems: "center", marginBottom: 8,
      }}>
        <Icon name="max" size={34} />
      </div>
      <div className="kk-h1" style={{ marginBottom: 2 }}>Подключите бота MAX</div>
      <div className="kk-body kk-muted" style={{ maxWidth: 460, lineHeight: 1.5 }}>
        Каскад приводит подписчиков из рекламы в ваш канал MAX и считает их стоимость.
        Начнём с бота-помощника — через него мы считаем лидов, отдаём лид-магниты
        и запускаем рассылки.
      </div>
      <Link href="/channels" className="kk-btn kk-btn-accent kk-btn-lg" style={{ marginTop: 10 }}>
        Подключить бота
        <Icon name="chevron_r" size={16} />
      </Link>
      <Link href="/magnets" className="kk-xs kk-muted" style={{ textDecoration: "underline" }}>
        Пока что настрою лид-магнит
      </Link>
    </div>
  );
}

/* ===================================================================
   Страница
   =================================================================== */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const source = (sp.source as SourceFilter) || "all";
  const campaignId = sp.campaign || null;
  const skipSetup = sp.skip_setup === "1";
  const supabase = await createClient();

  // Окно для sparklines и delta: 14 дней (текущие 7 vs предыдущие 7).
  const since14Iso = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  const [
    s, campaigns,
    { data: campRows },
    { count: botCount },
    { count: magnetCount },
    { count: funnelCount },
    { count: metrikaCount },
    { count: directCount },
    { data: subRow },
    { data: window14Leads },
    { data: dialogRows },
    { data: recentBroadcasts },
  ] = await Promise.all([
    getTenantStats({ source, campaignId }),
    getCampaignOptions(),
    supabase.from("direct_campaigns").select("name, cost, clicks").eq("tracked", true).order("cost", { ascending: false }),
    supabase.from("bots").select("id", { count: "exact", head: true }),
    supabase.from("magnets").select("id", { count: "exact", head: true }),
    supabase.from("funnels").select("id", { count: "exact", head: true }),
    supabase.from("metrika_configs").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("direct_accounts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("subscriptions").select("*").limit(1).maybeSingle(),
    supabase.from("leads").select("subscribed_at, magnet_sent_at").or(`subscribed_at.gte.${since14Iso},magnet_sent_at.gte.${since14Iso}`).limit(20000),
    supabase.from("dialog_messages").select("created_at").gte("created_at", since14Iso).limit(20000),
    supabase.from("broadcasts")
      .select("id, text, total, sent, failed, clicks, status, created_at, bots(channel_title)")
      .order("created_at", { ascending: false }).limit(3),
  ]);

  const sub = subRow as Subscription | null;
  const isTrial = sub?.plan === "trial";
  const daysLeft = sub ? trialDaysLeft(sub) : 0;

  // Новый юзер (нет ни бота, ни магнита) — ведём на /setup, если не скипнул.
  const isNewUser = (botCount ?? 0) === 0 && (magnetCount ?? 0) === 0;
  if (isNewUser && !skipSetup) redirect("/setup");

  // Пустое состояние — 0 ботов.
  const noBots = (botCount ?? 0) === 0;

  const tracked = campRows ?? [];
  const adSpend = tracked.reduce((a, c) => a + Number(c.cost), 0);
  const organic = Math.max(0, s.total - s.fromAds);

  // Стоимость подписчика = расход ÷ подписчики из рекламы.
  let cplValue = "—";
  let cplHint = "";
  if (adSpend === 0) {
    cplHint = "подключите Директ и отметьте кампании";
  } else if (s.adSubscribed === 0) {
    cplHint = "появится с первым подписчиком из рекламы";
  } else {
    cplValue = `${fmt(adSpend / s.adSubscribed)} ₽`;
    cplHint = "расход ÷ подписчики из рекламы";
  }

  /* --- Дневные бакеты за 14 дней для sparklines и delta --- */
  const dayKeys: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const dayIdx = new Map(dayKeys.map((k, i) => [k, i]));

  const subDaily = new Array(14).fill(0);
  const magnetDaily = new Array(14).fill(0);
  for (const l of (window14Leads ?? []) as Array<{ subscribed_at: string | null; magnet_sent_at: string | null }>) {
    if (l.subscribed_at) {
      const i = dayIdx.get(l.subscribed_at.slice(0, 10));
      if (i !== undefined) subDaily[i]++;
    }
    if (l.magnet_sent_at) {
      const i = dayIdx.get(l.magnet_sent_at.slice(0, 10));
      if (i !== undefined) magnetDaily[i]++;
    }
  }
  const dialogDaily = new Array(14).fill(0);
  for (const d of (dialogRows ?? []) as Array<{ created_at: string }>) {
    const i = dayIdx.get(d.created_at.slice(0, 10));
    if (i !== undefined) dialogDaily[i]++;
  }

  const last7 = <T,>(arr: T[]) => arr.slice(7);
  const prev7 = <T,>(arr: T[]) => arr.slice(0, 7);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const pctChange = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

  const subs7 = sum(last7(subDaily));
  const subsPrev7 = sum(prev7(subDaily));
  const mag7 = sum(last7(magnetDaily));
  const magPrev7 = sum(prev7(magnetDaily));
  const dlg7 = sum(last7(dialogDaily));
  const dlgPrev7 = sum(prev7(dialogDaily));

  const magnetPct = s.subscribed > 0 ? Math.round((s.magnet / s.subscribed) * 100) : 0;

  const broadcastsList = recentBroadcasts ?? [];

  return (
    <Shell active="dashboard" title="Дашборд" breadcrumbs={["Партнёрский канал", "Аналитика"]}>
      <div style={{ padding: "20px 24px 32px" }}>
        {noBots ? (
          <EmptyStateHero />
        ) : (
          <>
            {isTrial && <TrialBanner used={s.total} daysLeft={daysLeft} />}
            <OnboardingChecklist
              channel={(botCount ?? 0) > 0}
              magnet={(magnetCount ?? 0) > 0}
              funnel={(funnelCount ?? 0) > 0}
              metrika={(metrikaCount ?? 0) > 0}
              direct={(directCount ?? 0) > 0}
            />

            {/* ===== Заголовок ===== */}
            <header style={{ marginBottom: "var(--s-5)" }}>
              <h1 className="kk-h1" style={{ margin: 0 }}>Дашборд</h1>
              <div className="kk-body kk-muted" style={{ marginTop: 6 }}>
                Что происходит с вашим MAX-каналом
              </div>
            </header>

            <SourceFilterBar source={source} campaignId={campaignId} campaigns={campaigns} />

            {/* ===== Секция 1: KPI ===== */}
            <section className="kk-kpi-grid" style={{ marginTop: "var(--s-5)" }}>
              <KpiTile
                label="Активные подписчики"
                value={s.subscribed > 0 ? fmt(s.subscribed) : "—"}
                delta={subs7 + subsPrev7 > 0 ? { pct: pctChange(subs7, subsPrev7), positiveIsGood: true } : null}
                sparkline={last7(subDaily)}
                tone="violet"
                empty={s.subscribed === 0}
              />
              <KpiTile
                label="Магнит-конверсия"
                value={s.subscribed > 0 ? `${magnetPct}%` : "—"}
                delta={mag7 + magPrev7 > 0 ? { pct: pctChange(mag7, magPrev7), positiveIsGood: true } : null}
                sparkline={last7(magnetDaily)}
                tone="amber"
                empty={s.subscribed === 0}
              />
              <KpiTile
                label="Стоимость подписчика"
                value={cplValue}
                delta={null}
                sparkline={undefined}
                tone="coral"
                empty={cplValue === "—"}
              />
              <KpiTile
                label="Диалогов за 7 дней"
                value={dlg7 + dlgPrev7 > 0 ? fmt(dlg7) : "—"}
                delta={dlg7 + dlgPrev7 > 0 ? { pct: pctChange(dlg7, dlgPrev7), positiveIsGood: true } : null}
                sparkline={last7(dialogDaily)}
                tone="green"
                empty={dlg7 + dlgPrev7 === 0}
              />
            </section>

            {/* Подсказка под KPI: cплошной для одной ячейки */}
            {cplHint && cplValue === "—" && (
              <div className="kk-xs kk-muted" style={{ marginTop: 8, paddingLeft: 4 }}>
                <b style={{ color: "var(--n-600)" }}>Стоимость подписчика: </b>{cplHint}.
              </div>
            )}

            {/* ===== Секция 2: График + Донат ===== */}
            <section style={{
              marginTop: "var(--s-8)",
              display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16,
            }}>
              <ChartCard daily={s.daily} />
              <div className="kk-card kk-card-hover" style={{ padding: "var(--s-5)" }}>
                <SectionTitle sub="реклама против органики">Откуда приходят</SectionTitle>
                {s.total === 0 ? (
                  <div className="kk-muted kk-sm" style={{ padding: "30px 0", textAlign: "center" }}>
                    Пока нет подписчиков.
                  </div>
                ) : (
                  <div className="kk-row kk-gap-4" style={{ marginTop: 8 }}>
                    <Donut size={140} total={s.total} data={[
                      { value: s.fromAds, color: "var(--brand-violet)" },
                      { value: organic, color: "var(--n-300)" },
                    ]} />
                    <div className="kk-col kk-gap-3" style={{ flex: 1, minWidth: 0 }}>
                      {[
                        { c: "var(--brand-violet)", n: "Из рекламы", v: s.fromAds },
                        { c: "var(--n-300)", n: "Органика", v: organic },
                      ].map((r) => (
                        <div key={r.n} className="kk-row kk-gap-2 kk-sm">
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: r.c }} />
                          <span style={{ flex: 1 }}>{r.n}</span>
                          <span className="kk-num" style={{ fontWeight: 600 }}>{fmt(r.v)}</span>
                          <span className="kk-num kk-muted" style={{ width: 48, textAlign: "right" }}>
                            {s.total ? Math.round((r.v / s.total) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ===== Секция 3: Последние подписчики + Последние рассылки ===== */}
            <section style={{
              marginTop: "var(--s-8)",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
            }}>
              {/* Последние подписчики */}
              <div className="kk-card kk-card-hover" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "var(--s-5)", paddingBottom: 12, borderBottom: "1px solid var(--n-100)" }}>
                  <SectionTitle
                    sub="последние входы в бота"
                    action={
                      <Link href="/subscribers" className="kk-btn kk-btn-sm kk-btn-ghost" style={{ gap: 2 }}>
                        Все <Icon name="chevron_r" size={14} />
                      </Link>
                    }
                  >
                    Новые подписчики
                  </SectionTitle>
                </div>
                {s.recent.length === 0 ? (
                  <div className="kk-muted kk-sm" style={{ padding: "24px 20px", textAlign: "center" }}>
                    Пока никого.
                  </div>
                ) : (
                  <div className="kk-col" style={{ flex: 1 }}>
                    {s.recent.slice(0, 5).map((r, i) => {
                      const sourceLine = r.fromAds
                        ? (r.campaignName || (r.campaignId ? `Кампания #${r.campaignId}` : "из рекламы"))
                        : "органика";
                      return (
                        <div key={i} className="kk-row kk-gap-3" style={{
                          padding: "12px 20px",
                          borderTop: i ? "1px solid var(--n-100)" : 0,
                        }}>
                          <Avatar initials={(r.name[0] ?? "?").toUpperCase()} color={AV[i % AV.length]} size={34} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="kk-row kk-gap-2" style={{ marginBottom: 2 }}>
                              <span style={{
                                fontSize: 14, fontWeight: 600,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
                              }}>{r.name}</span>
                              <span className={`kk-chip ${STAGE_CLS[r.stage] ?? ""}`}
                                style={{ height: 18, fontSize: 10, padding: "0 6px", flexShrink: 0 }}>
                                {r.stage}
                              </span>
                            </div>
                            <div className="kk-xs kk-muted" style={{
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }} title={r.yclid ? `yclid ${r.yclid}` : undefined}>
                              {sourceLine}
                              {r.yclid && (
                                <span style={{ fontFamily: "var(--font-mono)", marginLeft: 6, opacity: 0.7 }}>
                                  · {r.yclid.slice(0, 10)}…
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="kk-xs kk-muted" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                            {relTime(r.when)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Последние рассылки */}
              <div className="kk-card kk-card-hover" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "var(--s-5)", paddingBottom: 12, borderBottom: "1px solid var(--n-100)" }}>
                  <SectionTitle
                    sub="последние отправки в MAX"
                    action={
                      <Link href="/broadcasts" className="kk-btn kk-btn-sm kk-btn-ghost" style={{ gap: 2 }}>
                        Все <Icon name="chevron_r" size={14} />
                      </Link>
                    }
                  >
                    Последние рассылки
                  </SectionTitle>
                </div>
                {broadcastsList.length === 0 ? (
                  <div className="kk-muted kk-sm" style={{ padding: "24px 20px", textAlign: "center", lineHeight: 1.5 }}>
                    Пока ничего не отправляли.{" "}
                    <Link href="/broadcasts" style={{ color: "var(--brand-violet)", fontWeight: 600 }}>
                      Создать рассылку →
                    </Link>
                  </div>
                ) : (
                  <div className="kk-col" style={{ flex: 1 }}>
                    {broadcastsList.map((b, i) => {
                      const text = (b.text as string | null) ?? "";
                      const total = (b.total as number | null) ?? 0;
                      const sent = (b.sent as number | null) ?? 0;
                      const clicks = (b.clicks as number | null) ?? 0;
                      const deliveryPct = total > 0 ? Math.round((sent / total) * 100) : 0;
                      const preview = text.replace(/\s+/g, " ").trim().slice(0, 80) || "Рассылка без текста";
                      return (
                        <div key={b.id as string} style={{
                          padding: "14px 20px",
                          borderTop: i ? "1px solid var(--n-100)" : 0,
                          display: "flex", gap: 12, alignItems: "flex-start",
                        }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: "var(--brand-violet-12)", color: "var(--brand-violet)",
                            display: "grid", placeItems: "center", flexShrink: 0,
                          }}>
                            <Icon name="broadcast" size={17} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="kk-row kk-gap-2" style={{ marginBottom: 4 }}>
                              <span style={{
                                fontSize: 13.5, fontWeight: 600, lineHeight: 1.35,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                flex: 1, minWidth: 0,
                              }}>{preview}</span>
                              <BroadcastStatus status={b.status as string | null} />
                            </div>
                            <div className="kk-xs kk-muted kk-num" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                              <span>
                                <b style={{ color: "var(--brand-ink)" }}>{fmt(sent)}</b>
                                <span style={{ opacity: 0.6 }}> / {fmt(total)}</span> доставлено
                                {deliveryPct > 0 && <span style={{ opacity: 0.55 }}> · {deliveryPct}%</span>}
                              </span>
                              {clicks > 0 && (
                                <span>
                                  <b style={{ color: "var(--brand-ink)" }}>{fmt(clicks)}</b> клик{clicks % 10 === 1 && clicks % 100 !== 11 ? "" : clicks % 10 >= 2 && clicks % 10 <= 4 && (clicks % 100 < 12 || clicks % 100 > 14) ? "а" : "ов"}
                                </span>
                              )}
                              <span style={{ marginLeft: "auto" }}>{relTime(b.created_at as string)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* ===== Секция 4: Кампании Директа ===== */}
            <section style={{ marginTop: "var(--s-8)" }}>
              <div className="kk-card kk-card-hover" style={{ padding: 0 }}>
                <div style={{ padding: "var(--s-5)", paddingBottom: 4 }}>
                  <SectionTitle
                    sub="отслеживаемые кампании · расход за 30 дней"
                    action={
                      <Link href="/campaigns" className="kk-btn kk-btn-sm kk-btn-ghost" style={{ gap: 2 }}>
                        Управлять <Icon name="chevron_r" size={14} />
                      </Link>
                    }
                  >
                    Кампании Яндекс Директа
                  </SectionTitle>
                </div>
                {tracked.length === 0 ? (
                  <div className="kk-muted kk-sm" style={{ padding: "20px 24px 28px", textAlign: "center", lineHeight: 1.5 }}>
                    Нет отслеживаемых кампаний. Подключите Директ и отметьте нужные —
                    появится расход и стоимость подписчика.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: "var(--n-500)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 600 }}>Кампания</th>
                          <th style={{ textAlign: "right", padding: "10px 8px", fontWeight: 600 }}>Клики</th>
                          <th style={{ textAlign: "right", padding: "10px 20px", fontWeight: 600 }}>Расход</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tracked.map((c, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--n-100)" }}>
                            <td style={{ padding: "12px 20px", fontWeight: 600, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.name || "Без названия"}
                            </td>
                            <td className="kk-num" style={{ textAlign: "right", padding: "12px 8px" }}>{fmt(c.clicks)}</td>
                            <td className="kk-num" style={{ textAlign: "right", padding: "12px 20px", fontWeight: 600 }}>{fmt(c.cost)} ₽</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}
