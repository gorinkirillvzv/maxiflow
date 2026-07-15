// Maxiflow — оформление подписки: создаёт платёж в Т-Банке, возвращает ссылку оплаты.
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSubscription, planPrice, PAID_PLANS, PLANS, type PlanId, type BillingPeriod } from "@/lib/billing";
import { tbankInit } from "@/lib/tbank";

const APP_URL = process.env.APP_URL || "https://maxiflow.ru";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const plan = body.plan as PlanId;
  const period = (body.period === "year" ? "year" : "month") as BillingPeriod;
  if (!PAID_PLANS.includes(plan)) {
    return Response.json({ error: "Неизвестный тариф" }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return Response.json({ error: "Нет рабочего пространства" }, { status: 400 });

  await getOrCreateSubscription(supabase, tenant.id);

  const rub = planPrice(plan, period);
  const amount = rub * 100; // копейки
  const orderId = `${tenant.id.slice(0, 8)}-${plan}-${period}-${Date.now()}`;
  const periodRu = period === "year" ? "год" : "месяц";
  const description = `Maxiflow — тариф «${PLANS[plan].name}», ${periodRu}`;

  const { error: insErr } = await supabase.from("billing_payments").insert({
    tenant_id: tenant.id,
    order_id: orderId,
    plan,
    billing_period: period,
    amount,
  });
  if (insErr) {
    return Response.json({ error: "Не удалось создать платёж" }, { status: 500 });
  }

  const res = await tbankInit({
    orderId,
    amount,
    description,
    customerKey: tenant.id,
    // Recurrent=Y НЕ передаём: с флагом рекуррентности Т-Банк не засчитывает
    // тестовый платёж при онбординге. Автосписание включим отдельным шагом,
    // когда боевой терминал активен и на нём разрешены рекуррентные платежи.
    recurrent: false,
    successUrl: `${APP_URL}/billing?paid=1`,
    failUrl: `${APP_URL}/billing?failed=1`,
    notificationUrl: `${APP_URL}/api/billing/webhook`,
  });

  if (!res.ok) {
    return Response.json({ error: res.error }, { status: 502 });
  }
  return Response.json({ ok: true, paymentUrl: res.paymentUrl });
}
