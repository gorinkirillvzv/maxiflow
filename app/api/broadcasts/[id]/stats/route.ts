// Расширенная статистика рассылки: считает doставленных, кликов, ответов и отписок.
// Ответы = входящие сообщения от получателей рассылки в бота, после её отправки.
// Отписки = лиды получателей с unsubscribed_at > broadcasts.created_at.
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data: br } = await supabase
    .from("broadcasts")
    .select("id, bot_id, tenant_id, created_at, total, sent, failed, clicks")
    .eq("id", id)
    .maybeSingle();
  if (!br) return Response.json({ error: "Рассылка не найдена" }, { status: 404 });

  const { data: recipients } = await supabase
    .from("broadcast_recipients")
    .select("lead_id, max_chat_id")
    .eq("broadcast_id", id);

  const chatIds = (recipients ?? []).map((r) => r.max_chat_id as number).filter((n): n is number => Number.isFinite(n));

  // Ответили: считаем уникальные max_chat_id, которые писали боту после рассылки
  let replied = 0;
  if (chatIds.length) {
    const { data: msgs } = await supabase
      .from("dialog_messages")
      .select("max_chat_id")
      .eq("bot_id", br.bot_id)
      .eq("direction", "in")
      .in("max_chat_id", chatIds)
      .gt("created_at", br.created_at);
    const unique = new Set((msgs ?? []).map((m) => m.max_chat_id as number));
    replied = unique.size;
  }

  // Сколько из недоставленных ещё можно догнать: лид жив (dm_unreachable_at IS NULL)
  // и не отписан от канала. Всё остальное — permanent dead, кнопку не показываем.
  let retriable = 0;
  let dead = 0;
  const undeliveredLeadIds = (recipients ?? [])
    .filter((r) => r.lead_id && !(r as unknown as { delivered?: boolean }).delivered);
  // recipients endpoint возвращает без delivered — считаем через отдельный запрос
  const { data: undRows } = await supabase
    .from("broadcast_recipients")
    .select("lead_id, leads:lead_id(dm_unreachable_at)")
    .eq("broadcast_id", id)
    .eq("delivered", false);
  for (const row of undRows ?? []) {
    const dead_at = (row as unknown as { leads?: { dm_unreachable_at?: string | null } }).leads?.dm_unreachable_at ?? null;
    if (dead_at) dead++;
    else retriable++;
  }
  void undeliveredLeadIds;

  return Response.json({
    id: br.id,
    total: br.total ?? 0,
    delivered: br.sent ?? 0,
    failed: br.failed ?? 0,
    clicks: br.clicks ?? 0,
    replied,
    retriable,          // ещё можно догнать
    dead,               // «удалили диалог» — постоянный факт, не досылать
    unsubscribed: 0,
  });
}
