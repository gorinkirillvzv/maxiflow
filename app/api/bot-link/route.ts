// Привязка владельца к боту: одноразовый токен, чтобы он прислал кружки/файлы
// со своего MAX-аккаунта. Без привязки бот игнорирует медиа от случайных подписчиков.
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";
import { audit } from "@/lib/audit";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const botId = url.searchParams.get("bot_id");
  if (!botId) return Response.json({ error: "Нужен bot_id" }, { status: 400 });

  const { data } = await supabase
    .from("bot_admins")
    .select("max_user_id, added_at")
    .eq("bot_id", botId)
    .order("added_at", { ascending: true });
  return Response.json({ admins: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const botId = typeof body.bot_id === "string" ? body.bot_id : null;
  if (!botId) return Response.json({ error: "Нужен bot_id" }, { status: 400 });

  const { data: bot } = await supabase
    .from("bots").select("tenant_id, max_bot_username").eq("id", botId).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });

  const token = randomBytes(8).toString("hex");
  const { error } = await supabase.from("bot_link_tokens").insert({
    token, bot_id: botId, tenant_id: bot.tenant_id,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const link = `https://max.ru/${bot.max_bot_username}?start=link_${token}`;
  return Response.json({ token, link, max_bot_username: bot.max_bot_username });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const botId = url.searchParams.get("bot_id");
  const maxUserId = url.searchParams.get("max_user_id");
  if (!botId || !maxUserId) return Response.json({ error: "Нужны bot_id и max_user_id" }, { status: 400 });

  const { data: bot } = await supabase.from("bots").select("tenant_id").eq("id", botId).maybeSingle();
  const { error } = await supabase
    .from("bot_admins")
    .delete()
    .eq("bot_id", botId)
    .eq("max_user_id", Number(maxUserId));
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (bot?.tenant_id) {
    await audit(supabase, request, {
      tenantId: bot.tenant_id,
      action: "bot_admin.unlink",
      targetType: "bot_admin",
      targetId: `${botId}:${maxUserId}`,
    });
  }
  return Response.json({ ok: true });
}
