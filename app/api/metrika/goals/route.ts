// PATCH /api/metrika/goals — обновление имён двух целей Метрики у арендатора.
import { createClient } from "@/lib/supabase/server";

const GOAL_RE = /^[A-Za-z0-9_-]{2,64}$/;

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("owner_auth_id", user.id).maybeSingle();
  if (!tenant) return Response.json({ error: "Арендатор не найден" }, { status: 400 });

  let body: { goal_name?: unknown; subscribed_goal_name?: unknown };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const goalName = typeof body.goal_name === "string" ? body.goal_name.trim() : "";
  const subGoal = typeof body.subscribed_goal_name === "string"
    ? body.subscribed_goal_name.trim()
    : "";

  if (!GOAL_RE.test(goalName)) {
    return Response.json({ error: "Цель «магнит»: латиница/цифры/_/-" }, { status: 400 });
  }
  if (subGoal && !GOAL_RE.test(subGoal)) {
    return Response.json({ error: "Цель «подписка»: латиница/цифры/_/-" }, { status: 400 });
  }

  const { error } = await supabase
    .from("metrika_configs")
    .update({ goal_name: goalName, subscribed_goal_name: subGoal || null })
    .eq("tenant_id", tenant.id)
    .eq("is_active", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
