// Предпросмотр аудитории рассылки. Считает количество подписчиков, которым дойдёт
// сообщение, без отправки. Быстрая операция, без rate-limit.
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const botId = url.searchParams.get("bot_id");
  const tagId = url.searchParams.get("tag_id");
  if (!botId) return Response.json({ error: "Нужен bot_id" }, { status: 400 });

  let taggedIds: string[] | null = null;
  if (tagId) {
    const { data: lt } = await supabase.from("lead_tags").select("lead_id").eq("tag_id", tagId);
    taggedIds = (lt ?? []).map((x) => x.lead_id as string);
    if (taggedIds.length === 0) {
      return Response.json({ count: 0 });
    }
  }

  // Аудитория рассылки = только те, у кого открыт DM с ботом (есть хотя бы одна запись
  // в dialog_messages в любую сторону). Просто подписчики канала MAX не пустит через bot API.
  // Supabase JS режет .select() по 1000 строк — берём страницами до конца.
  const activeUserSet = new Set<number>();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data } = await supabase
      .from("dialog_messages")
      .select("max_user_id")
      .eq("bot_id", botId)
      .range(from, from + PAGE - 1);
    const rows = data ?? [];
    for (const r of rows) {
      const v = r.max_user_id;
      if (v != null) activeUserSet.add(v as number);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  const activeUserIds = Array.from(activeUserSet);
  if (activeUserIds.length === 0) return Response.json({ count: 0 });

  let q = supabase.from("leads")
    .select("max_chat_id", { count: "exact", head: true })
    .eq("bot_id", botId)
    .not("max_chat_id", "is", null)
    .is("unsubscribed_at", null)
    .is("dm_unreachable_at", null)     // не считаем юзеров с мёртвым chat_id
    .in("max_user_id", activeUserIds);
  if (taggedIds) q = q.in("id", taggedIds);
  const { count } = await q;
  return Response.json({ count: count ?? 0 });
}
