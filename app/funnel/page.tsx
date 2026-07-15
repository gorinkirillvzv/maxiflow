// Каскад — Воронка на реальных данных leads. Дизайн-основа: screens/funnel.jsx
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/ui";
import { getTenantStats } from "@/lib/analytics";

export default async function FunnelPage() {
  const s = await getTenantStats();

  const stages = [
    { label: "Зашли в бота", detail: "нажали «Начать» — пришли из рекламы или органики", value: s.total, color: "#7C5CFF" },
    { label: "Подписались на канал", detail: "подтвердили подписку в боте", value: s.subscribed, color: "#5B47FB" },
    { label: "Забрали лид-магнит", detail: "получили материал после проверки", value: s.magnet, color: "#4A38E0" },
    { label: "Конверсия в Метрику", detail: "офлайн-конверсия ушла в Директ", value: s.conversions, color: "#00B956" },
  ];
  const max = stages[0].value || 1;

  return (
    <Shell active="funnel" title="Воронка: клик → подписка → магнит" breadcrumbs={["Аналитика", "Воронка"]}>
      <div style={{ padding: "20px 24px 32px", display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>

        <div className="kk-card kk-pad-6">
          <SectionTitle sub="каждая ступень — реальное действие пользователя из таблицы лидов">
            Этапы воронки
          </SectionTitle>

          {s.total === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--n-500)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--brand-violet-12)", color: "var(--brand-violet)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Icon name="funnel" size={22} />
              </div>
              <div className="kk-h4" style={{ color: "var(--brand-ink)" }}>Пока нет данных</div>
              <div className="kk-sm" style={{ marginTop: 4 }}>Как только пользователи начнут заходить в бота — воронка заполнится.</div>
            </div>
          ) : (
            <div className="kk-col" style={{ marginTop: 8 }}>
              {stages.map((row, i) => {
                const widthPct = (row.value / max) * 100;
                const conv = i > 0 ? ((row.value / (stages[i - 1].value || 1)) * 100).toFixed(1) : null;
                const lost = i > 0 ? stages[i - 1].value - row.value : 0;
                return (
                  <div key={row.label} style={{ padding: "12px 0" }}>
                    <div className="kk-row kk-gap-4" style={{ alignItems: "center" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: row.color + "20", color: row.color, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{row.label}</span>
                            <span className="kk-xs kk-muted" style={{ marginLeft: 8 }}>{row.detail}</span>
                          </div>
                          <div className="kk-row kk-gap-3">
                            <span className="kk-num" style={{ fontWeight: 700, fontSize: 16 }}>{row.value.toLocaleString("ru")}</span>
                            {conv && (
                              <span className="kk-chip" style={{
                                background: parseFloat(conv) < 30 ? "var(--brand-coral-12)" : parseFloat(conv) < 70 ? "var(--brand-amber-12)" : "var(--success-12)",
                                color: parseFloat(conv) < 30 ? "#B12E1A" : parseFloat(conv) < 70 ? "#8A5A00" : "#0A7A3C",
                              }}>{conv}%</span>
                            )}
                          </div>
                        </div>
                        <div style={{ width: "100%", height: 22, borderRadius: 6, background: "var(--n-50)", overflow: "hidden" }}>
                          <div style={{ width: `${widthPct}%`, height: "100%", background: `linear-gradient(90deg, ${row.color}, ${row.color}cc)`, borderRadius: 6 }} />
                        </div>
                        {i > 0 && lost > 0 && (
                          <div className="kk-row kk-gap-2 kk-xs" style={{ marginTop: 4, color: "var(--n-500)" }}>
                            <Icon name="trend_dn" size={11} /> уходит {lost.toLocaleString("ru")} чел.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="kk-row kk-gap-3" style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "var(--brand-paper)" }}>
            <div className="kk-col" style={{ flex: 1 }}>
              <div className="kk-xs kk-muted">Сквозная конверсия</div>
              <div className="kk-num" style={{ fontWeight: 700, fontSize: 20 }}>
                бот → магнит <span style={{ color: "var(--brand-violet)" }}>= {s.pctMagnet}%</span>
              </div>
            </div>
            <div className="kk-col" style={{ flex: 1 }}>
              <div className="kk-xs kk-muted">Из рекламы (с yclid)</div>
              <div className="kk-num" style={{ fontWeight: 700, fontSize: 20 }}>
                <span style={{ color: "var(--brand-amber)" }}>{s.fromAds}</span> из {s.total}
              </div>
            </div>
          </div>
        </div>

        {/* правая колонка */}
        <div className="kk-col kk-gap-4">
          <div className="kk-card kk-pad-5" style={{ background: "var(--brand-violet-12)", border: "1px solid var(--brand-violet-20)" }}>
            <div className="kk-row kk-gap-2" style={{ marginBottom: 8 }}>
              <Icon name="sparkles" size={14} stroke="var(--brand-violet-pressed)" />
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--brand-violet-pressed)" }}>Что выше воронки</span>
            </div>
            <div className="kk-sm" style={{ color: "var(--n-700)", lineHeight: 1.5 }}>
              Ступени «Показы» и «Клики» появятся после подключения Яндекс.Директа —
              тогда воронка станет полной: от показа объявления до конверсии.
            </div>
          </div>

          <div className="kk-card kk-pad-5">
            <SectionTitle sub="последние действия">Свежие лиды</SectionTitle>
            {s.recent.length === 0 ? (
              <div className="kk-sm kk-muted">Пока пусто</div>
            ) : (
              <div className="kk-col kk-gap-2" style={{ marginTop: 4 }}>
                {s.recent.map((r, i) => (
                  <div key={i} className="kk-row kk-gap-2 kk-sm" style={{ padding: "6px 0", borderTop: i ? "1px solid var(--n-100)" : 0 }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{r.name}</span>
                    {r.fromAds && <span className="kk-chip kk-chip-amber" style={{ height: 18, fontSize: 10 }}>реклама</span>}
                    <span className="kk-chip" style={{ height: 18, fontSize: 10 }}>{r.stage}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
