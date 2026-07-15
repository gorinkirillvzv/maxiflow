// Запланированные посты: список (GET) и отмена (DELETE). RLS режет по арендатору.
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("id, bot_id, text, button_text, scheduled_at, status, error, sent_at")
    .in("status", ["pending", "sending", "failed"])
    .order("scheduled_at", { ascending: true });

  if (error) return Response.json({ error: "Ошибка загрузки" }, { status: 500 });
  return Response.json({ posts: data ?? [] });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  // отменить можно только ещё не отправленный пост
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return Response.json({ error: "Не удалось отменить" }, { status: 500 });
  return Response.json({ ok: true });
}
