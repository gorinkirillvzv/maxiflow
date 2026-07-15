// Maxiflow — webhook Т-Банка: уведомление об оплате → активация подписки.
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyNotification } from "@/lib/tbank";
import type { BillingPeriod } from "@/lib/billing";

function periodEnd(period: BillingPeriod): string {
  const d = new Date();
  if (period === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return new Response("OK"); // невалидное тело — подтверждаем приём, не ретраим
  }

  if (!verifyNotification(payload)) {
    return new Response("FORBIDDEN", { status: 403 });
  }

  const orderId = payload.OrderId as string | undefined;
  const status = payload.Status as string | undefined;
  if (!orderId) return new Response("OK");

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("billing_payments")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!payment) return new Response("OK");

  // успешная оплата
  if (status === "CONFIRMED" || status === "AUTHORIZED") {
    if (payment.status === "confirmed") return new Response("OK"); // идемпотентность

    await admin.from("billing_payments").update({
      status: "confirmed",
      tbank_payment_id: payload.PaymentId ? String(payload.PaymentId) : null,
      paid_at: new Date().toISOString(),
    }).eq("id", payment.id);

    const update: Record<string, unknown> = {
      plan: payment.plan,
      status: "active",
      billing_period: payment.billing_period,
      current_period_end: periodEnd(payment.billing_period as BillingPeriod),
      updated_at: new Date().toISOString(),
    };
    if (payload.RebillId) update.rebill_id = String(payload.RebillId);

    await admin.from("subscriptions")
      .update(update)
      .eq("tenant_id", payment.tenant_id);

    // audit log — серьёзное событие, нужно видеть
    await admin.from("audit_log").insert({
      tenant_id: payment.tenant_id,
      actor_user_id: null,
      actor_email: "system:tbank-webhook",
      action: "billing.payment_confirmed",
      target_type: "subscription",
      target_id: payment.tenant_id,
      after_state: { plan: payment.plan, period: payment.billing_period, payment_id: payment.id },
      ip: null,
      user_agent: "tbank-webhook",
    });
  } else if (status === "REJECTED" || status === "DEADLINE_EXPIRED" || status === "CANCELED") {
    if (payment.status === "new") {
      await admin.from("billing_payments")
        .update({ status: "rejected" })
        .eq("id", payment.id);
    }
  }

  return new Response("OK");
}
