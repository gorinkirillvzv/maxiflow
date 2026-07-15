// Библиотека медиа: список и удаление. Загрузка идёт через бота (пересылка в ЛС).
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const botId = url.searchParams.get("bot_id");
  const kind = url.searchParams.get("kind");

  let q = supabase
    .from("media_assets")
    .select("id, bot_id, kind, token, name, thumbnail_url, duration_sec, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (botId) q = q.eq("bot_id", botId);
  if (kind) q = q.eq("kind", kind);

  const { data } = await q;
  return Response.json({ media: data ?? [] });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
