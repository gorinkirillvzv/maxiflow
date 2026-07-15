// Maxiflow — Тариф: текущая подписка, расход лимита, выбор тарифа.
import { Shell } from "@/components/Shell";
import { ProgressBar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSubscription, PLANS, subscriberLimit, isActive } from "@/lib/billing";
import { BillingPlans } from "@/components/BillingPlans";

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default async function BillingPage({ searchParams }: {
  searchParams: Promise<{ paid?: string; failed?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();

  if (!tenant) {
    return (
      <Shell active="billing" title="Тариф" breadcrumbs={["Тариф"]}>
        <div style={{ padding: "20px 24px" }}>
          <div className="kk-card kk-pad-6 kk-muted kk-sm">Не удалось загрузить тариф.</div>
        </div>
      </Shell>
    );
  }

  const sub = await getOrCreateSubscription(supabase, tenant.id);
  const { count } = await supabase
    .from("leads").select("id", { count: "exact", head: true });
  const used = count ?? 0;
  const limit = subscriberLimit(sub);
  const plan = PLANS[sub.plan];
  const overLimit = used >= limit;
  const active = isActive(sub);

  return (
    <Shell active="billing" title="Тариф" breadcrumbs={["Тариф"]}>
      <div style={{ padding: "20px 24px", maxWidth: 1000 }}>

        {sp.paid && (
          <div className="kk-row kk-gap-2" style={{
            marginBottom: 16, padding: "12px 14px", borderRadius: 10,
            background: "var(--success-12)", color: "#0A7A3C",
          }}>
            <Icon name="check" size={16} strokeWidth={2.5} />
            <span className="kk-sm" style={{ fontWeight: 600 }}>
              Оплата прошла — тариф активирован.
            </span>
          </div>
        )}
        {sp.failed && (
          <div className="kk-row kk-gap-2" style={{
            marginBottom: 16, padding: "12px 14px", borderRadius: 10,
            background: "var(--brand-coral-12)", color: "#B12E1A",
          }}>
            <Icon name="bell" size={16} />
            <span className="kk-sm" style={{ flex: 1 }}>
              Оплата не завершена. Попробуйте ещё раз или выберите другой способ.
            </span>
          </div>
        )}

        {/* текущая подписка */}
        <div className="kk-card kk-pad-5" style={{ marginBottom: 20 }}>
          <div className="kk-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="kk-xs kk-muted">Текущий тариф</div>
              <div className="kk-h3" style={{ marginTop: 2 }}>{plan.name}</div>
            </div>
            <div>
              {sub.plan === "trial" ? (
                <span className="kk-chip kk-chip-amber" style={{ height: 26 }}>Бесплатный</span>
              ) : active ? (
                <span className="kk-chip kk-chip-green" style={{ height: 26 }}>Активна</span>
              ) : (
                <span className="kk-chip kk-chip-coral" style={{ height: 26 }}>Истекла</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <span className="kk-sm kk-muted">Подписчиков бота</span>
              <span className="kk-sm kk-num" style={{ fontWeight: 600 }}>
                {fmt(used)} / {fmt(limit)}
              </span>
            </div>
            <ProgressBar value={used} max={limit || 1}
              color={overLimit ? "var(--danger)" : "var(--brand-violet)"} height={8} />
          </div>

          {overLimit && (
            <div className="kk-row kk-gap-2" style={{
              marginTop: 14, padding: "10px 12px", borderRadius: 10,
              background: "var(--brand-coral-12)", color: "#B12E1A",
            }}>
              <Icon name="bell" size={15} />
              <span className="kk-sm" style={{ flex: 1 }}>
                Лимит тарифа исчерпан — новым подписчикам бот не выдаёт лид-магнит.
                Обновите тариф, чтобы продолжить приём.
              </span>
            </div>
          )}

          {sub.plan !== "trial" && active && sub.current_period_end && (
            <div className="kk-xs kk-muted" style={{ marginTop: 12 }}>
              Подписка активна до {new Date(sub.current_period_end).toLocaleDateString("ru-RU")}
              {" · "}
              {sub.billing_period === "year" ? "годовая" : "ежемесячная"} оплата
            </div>
          )}
        </div>

        <BillingPlans currentPlan={sub.plan} />

        <div className="kk-xs kk-muted" style={{ marginTop: 16, textAlign: "center" }}>
          Оплата картой через Т-Банк. Лимит считается по числу подписчиков, которых привёл бот.
        </div>
      </div>
    </Shell>
  );
}
