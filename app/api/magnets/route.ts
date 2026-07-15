// Лид-магниты арендатора: список (GET) и создание (POST).
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSubscription, PLANS } from "@/lib/billing";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data, error } = await supabase
    .from("magnets")
    .select("id, bot_id, title, description, delivery_text, is_active, created_at, bots(channel_title)")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ magnets: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_auth_id", user.id)
    .single();
  if (!tenant) return Response.json({ error: "Арендатор не найден" }, { status: 400 });

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!b.bot_id || !b.title) {
    return Response.json({ error: "Нужны бот и название магнита" }, { status: 400 });
  }

  // лимит лид-магнитов по тарифу
  const sub = await getOrCreateSubscription(supabase, tenant.id);
  const { count } = await supabase
    .from("magnets").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id);
  if ((count ?? 0) >= PLANS[sub.plan].magnets) {
    return Response.json({
      error: `На тарифе «${PLANS[sub.plan].name}» доступно ${PLANS[sub.plan].magnets} лид-магнитов. Обновите тариф, чтобы добавить ещё.`,
    }, { status: 403 });
  }

  const row: Record<string, unknown> = {
    tenant_id: tenant.id,
    bot_id: b.bot_id,
    title: b.title,
    description: b.description ?? null,
  };
  // тексты сценария — пишем только заполненные, остальное возьмёт дефолт схемы
  for (const f of [
    "welcome_text", "subscribe_button_text", "check_button_text",
    "not_subscribed_text", "delivery_text",
  ]) {
    if (typeof b[f] === "string" && (b[f] as string).trim()) row[f] = b[f];
  }

  const { data, error } = await supabase
    .from("magnets")
    .insert(row)
    .select("id, title")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ magnet: data });
}
