// Maxiflow — настройка кампании Директа: отслеживать (tracked) и привязка к боту.
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const campaignId = Number(body.campaign_id);
  if (!campaignId) return Response.json({ error: "Нужен campaign_id" }, { status: 400 });

  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return Response.json({ error: "Нет рабочего пространства" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.tracked === "boolean") patch.tracked = body.tracked;
  if ("bot_id" in body) patch.bot_id = body.bot_id || null;
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const { error } = await supabase
    .from("direct_campaigns")
    .update(patch)
    .eq("tenant_id", tenant.id)
    .eq("campaign_id", campaignId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
