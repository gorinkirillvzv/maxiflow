// Онлайн-чат дожима: список диалогов, переписка, ответ оператора.
import { createClient } from "@/lib/supabase/server";
import { maybeDecrypt } from "@/lib/crypto";
import { botSendMessage } from "@/lib/botSend";

type Row = {
  bot_id: string; max_user_id: number; max_chat_id: number | null;
  direction: string; text: string; created_at: string;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const userId = sp.get("user");
  const botId = sp.get("bot");

  // переписка одного диалога + lead-контекст для правой панели
  if (userId && botId) {
    const userIdNum = Number(userId);
    const [
      { data: msgs },
      { data: lead },
      { data: ltRows },
      { data: tags },
    ] = await Promise.all([
      supabase.from("dialog_messages")
        .select("direction, text, created_at")
        .eq("bot_id", botId).eq("max_user_id", userIdNum)
        .order("created_at", { ascending: true }).limit(200),
      supabase.from("leads")
        .select("id, max_username, first_name, last_name, yclid, direct_campaign_name, direct_campaign_id, ad_source_id, first_seen_at, subscribed_at, magnet_sent_at, unsubscribed_at, unsubscribed_reason, conversion_sent_at, operator_note, conversation_closed_at, ad_sources(name)")
        .eq("bot_id", botId).eq("max_user_id", userIdNum).maybeSingle(),
      supabase.from("lead_tags")
        .select("tag_id, leads!inner(bot_id, max_user_id)")
        .eq("leads.bot_id", botId).eq("leads.max_user_id", userIdNum),
      supabase.from("tags").select("id, name, color"),
    ]);

    const tagsById = new Map((tags ?? []).map((t) => [t.id, t]));
    const leadTagIds = (ltRows ?? []).map((r) => r.tag_id);
    const leadTags = leadTagIds.map((id) => tagsById.get(id)).filter(Boolean);

    return Response.json({
      messages: msgs ?? [],
      lead: lead ?? null,
      tags: leadTags,
    });
  }

  // список диалогов (RLS ограничит арендатором)
  const { data: rows } = await supabase
    .from("dialog_messages")
    .select("bot_id, max_user_id, max_chat_id, direction, text, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const convos = new Map<number, Row & { unread: number }>();
  for (const m of (rows ?? []) as Row[]) {
    const existing = convos.get(m.max_user_id);
    if (!existing) {
      convos.set(m.max_user_id, { ...m, unread: m.direction === "in" ? 1 : 0 });
    }
  }

  // имена из leads
  const ids = [...convos.keys()];
  const names = new Map<number, string>();
  if (ids.length) {
    const { data: leads } = await supabase
      .from("leads")
      .select("max_user_id, first_name, last_name")
      .in("max_user_id", ids);
    for (const l of leads ?? []) {
      names.set(l.max_user_id, [l.first_name, l.last_name].filter(Boolean).join(" ") || "Без имени");
    }
  }

  const list = [...convos.values()].map((c) => ({
    bot_id: c.bot_id,
    max_user_id: c.max_user_id,
    name: names.get(c.max_user_id) ?? "Без имени",
    last_text: c.text,
    last_direction: c.direction,
    last_at: c.created_at,
  }));
  return Response.json({ conversations: list });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const { bot_id, max_user_id, text } = body;
  if (!bot_id || !max_user_id || !text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Не хватает данных" }, { status: 400 });
  }

  const { data: bot } = await supabase
    .from("bots").select("bot_token, tenant_id, platform").eq("id", bot_id).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });

  // chat_id для ответа — из последнего сообщения диалога или из leads
  const { data: last } = await supabase
    .from("dialog_messages")
    .select("max_chat_id")
    .eq("bot_id", bot_id).eq("max_user_id", Number(max_user_id))
    .not("max_chat_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  let chatId = last?.max_chat_id as number | undefined;
  if (!chatId) {
    const { data: lead } = await supabase
      .from("leads").select("max_chat_id")
      .eq("bot_id", bot_id).eq("max_user_id", Number(max_user_id)).maybeSingle();
    chatId = lead?.max_chat_id as number | undefined;
  }
  if (!chatId) return Response.json({ error: "Нет чата с этим пользователем" }, { status: 400 });

  const botToken = maybeDecrypt(bot.bot_token);
  if (!botToken) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });
  const platform = (bot.platform as "max" | "telegram") ?? "max";
  const res = await botSendMessage(platform, botToken, chatId, text.trim());
  if (!res.ok) {
    return Response.json({ error: `${platform === "telegram" ? "Telegram" : "MAX"} отклонил отправку (${res.status})` }, { status: 502 });
  }

  await supabase.from("dialog_messages").insert({
    tenant_id: bot.tenant_id,
    bot_id,
    max_user_id: Number(max_user_id),
    max_chat_id: chatId,
    direction: "out",
    text: text.trim(),
  });
  return Response.json({ ok: true });
}

// PATCH — заметка оператора, статус закрытия диалога
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: { bot_id?: string; max_user_id?: number; operator_note?: string; closed?: boolean };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.bot_id || !body.max_user_id) return Response.json({ error: "Нужны bot_id и max_user_id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.operator_note === "string") patch.operator_note = body.operator_note;
  if (typeof body.closed === "boolean") {
    patch.conversation_closed_at = body.closed ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "Нечего обновлять" }, { status: 400 });

  const { error } = await supabase.from("leads").update(patch)
    .eq("bot_id", body.bot_id).eq("max_user_id", body.max_user_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
