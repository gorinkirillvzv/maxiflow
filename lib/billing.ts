// Maxiflow — тарифы и подписки.
// Лимит — число подписчиков бота (записей leads по арендатору).
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanId = "trial" | "start" | "business" | "scale";
export type BillingPeriod = "month" | "year";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  subscriberLimit: number;
  bots: number;
  funnels: number;  // лимит воронок
  magnets: number;  // лимит лид-магнитов
  priceMonth: number; // ₽
  priceYear: number;  // ₽
  abtest: boolean;
};

const UNLIM = 9999;

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial", name: "Бесплатный", tagline: "Попробовать на реальном трафике",
    subscriberLimit: 50, bots: 1, funnels: 3, magnets: 3,
    priceMonth: 0, priceYear: 0, abtest: false,
  },
  start: {
    id: "start", name: "Старт", tagline: "Для одного канала",
    subscriberLimit: 1000, bots: 1, funnels: UNLIM, magnets: UNLIM,
    priceMonth: 1990, priceYear: 19900, abtest: false,
  },
  business: {
    id: "business", name: "Бизнес", tagline: "Несколько каналов и A/B",
    subscriberLimit: 5000, bots: 3, funnels: UNLIM, magnets: UNLIM,
    priceMonth: 4990, priceYear: 47900, abtest: true,
  },
  scale: {
    id: "scale", name: "Масштаб", tagline: "Большой поток подписчиков",
    subscriberLimit: 20000, bots: 9999, funnels: UNLIM, magnets: UNLIM,
    priceMonth: 9900, priceYear: 95000, abtest: true,
  },
};

export const PAID_PLANS: PlanId[] = ["start", "business", "scale"];

// Бесплатный тариф: 14 дней с момента регистрации ИЛИ до 50 подписчиков.
export const TRIAL_DAYS = 14;

export type Subscription = {
  id: string;
  tenant_id: string;
  plan: PlanId;
  status: string; // trialing | active | past_due | expired | canceled
  billing_period: BillingPeriod;
  trial_ends_at: string | null;
  current_period_end: string | null;
  rebill_id: string | null;
  created_at: string;
};

/** Цена тарифа за период, ₽. */
export function planPrice(plan: PlanId, period: BillingPeriod): number {
  return period === "year" ? PLANS[plan].priceYear : PLANS[plan].priceMonth;
}

/** Активна ли подписка прямо сейчас. Бесплатный — 14 дней от регистрации. */
export function isActive(sub: Subscription): boolean {
  if (sub.plan === "trial") {
    const created = new Date(sub.created_at).getTime();
    return Date.now() - created < TRIAL_DAYS * 86400000;
  }
  if (sub.status === "active") {
    return !sub.current_period_end ||
      new Date(sub.current_period_end).getTime() > Date.now();
  }
  return false;
}

/** Сколько дней триала осталось (0 если истёк). */
export function trialDaysLeft(sub: Subscription): number {
  if (sub.plan !== "trial") return 0;
  const created = new Date(sub.created_at).getTime();
  const passedDays = (Date.now() - created) / 86400000;
  return Math.max(0, Math.ceil(TRIAL_DAYS - passedDays));
}

/** Лимит подписчиков с учётом активности (0 — если платная подписка истекла). */
export function subscriberLimit(sub: Subscription): number {
  return isActive(sub) ? PLANS[sub.plan].subscriberLimit : 0;
}

/** Сколько лендингов разрешено тарифу. */
export const LANDING_LIMITS: Record<PlanId, number> = {
  trial:    3,
  start:    10,
  business: 20,
  scale:    50,
};
export function landingLimit(sub: Subscription | null): number {
  if (!sub) return 0;
  return isActive(sub) ? LANDING_LIMITS[sub.plan] : 0;
}

/** Подписка арендатора; создаёт бесплатную при отсутствии. */
export async function getOrCreateSubscription(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Subscription> {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (data) return data as Subscription;

  const { data: created } = await supabase
    .from("subscriptions")
    .insert({ tenant_id: tenantId, plan: "trial", status: "trialing" })
    .select("*")
    .single();
  return created as Subscription;
}
