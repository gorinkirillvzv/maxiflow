// Боты арендатора: список (GET) и подключение нового (POST), отключение (DELETE).
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { createConfirmation } from "@/lib/confirmation";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  // Maxiflow — MAX-only продукт. Telegram-боты, если такие остались в БД,
  // в UI не показываем. Колонку platform в БД оставляем — фильтр только на выборке.
  const { data, error } = await supabase
    .from("bots")
    .select("id, max_bot_username, channel_title, channel_id, is_active, platform, channel_post_url")
    .eq("platform", "max")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ bots: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  // арендатор текущего пользователя
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_auth_id", user.id)
    .single();
  if (!tenant) return Response.json({ error: "Арендатор не найден" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { token, max_bot_username, max_bot_user_id, channel_id, channel_link, channel_title } = body;
  if (!token || typeof token !== "string" || !max_bot_username || !channel_id) {
    return Response.json({ error: "Не хватает данных бота или канала" }, { status: 400 });
  }

  // RLS пропустит insert только для своего tenant_id
  const { data, error } = await supabase
    .from("bots")
    .insert({
      tenant_id: tenant.id,
      bot_token: encrypt(token),
      max_bot_username,
      max_bot_user_id,
      channel_id,
      channel_link,
      channel_title,
    })
    .select("id, max_bot_username, channel_title")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Этот бот уже подключён" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ bot: data });
}

// Отключение/удаление бота. По умолчанию soft (is_active=false), сохраняет историю.
// При ?hard=1 — удаление навсегда с каскадом всех связанных данных, требуется
// дополнительная защита ввода названия канала (проверяется в UI ДО запроса).
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const hard = url.searchParams.get("hard") === "1";
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const { data: bot } = await supabase
    .from("bots").select("tenant_id, max_bot_username, channel_title, is_active").eq("id", id).maybeSingle();
  if (!bot?.tenant_id) return Response.json({ error: "Бот не найден" }, { status: 404 });

  if (hard && bot.is_active) {
    return Response.json({ error: "Сначала отключи бота, потом можно удалять навсегда." }, { status: 400 });
  }

  const name = bot.channel_title ?? bot.max_bot_username;
  try {
    const { sentTo } = await createConfirmation(supabase, request, {
      tenantId: bot.tenant_id,
      action: hard ? "bot.delete" : "bot.disconnect",
      description: hard
        ? `Удалить бот «${name}» НАВСЕГДА. Удалятся все лиды, диалоги, рассылки, воронки, лендинги и источники этого бота. Действие необратимо.`
        : `Отключить бот «${name}». Бот перестанет принимать подписчиков из рекламы. Лиды и история останутся, можно подключить заново.`,
      payload: { id },
    });
    return Response.json({
      ok: true,
      requires_confirmation: true,
      sent_to: sentTo,
      message: hard
        ? `На ${sentTo} отправлено письмо. Подтверди в нём для безвозвратного удаления.`
        : `На ${sentTo} отправлено письмо. Подтверди в нём, чтобы отключить бота.`,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Ошибка отправки подтверждения" }, { status: 500 });
  }
}

// Re-enable отключённого бота (is_active=true) — безопасное обратное действие.
// Или обновление channel_post_url — URL поста канала для сценария «реклама → пост → кнопка».
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: { id?: string; is_active?: boolean; channel_post_url?: string | null };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (body.is_active === true) {
    update.is_active = true;
  }

  if (body.channel_post_url !== undefined) {
    const raw = (body.channel_post_url ?? "").trim();
    if (raw === "") {
      update.channel_post_url = null;
    } else if (!/^https?:\/\//.test(raw) || raw.length > 500) {
      return Response.json({ error: "URL должен начинаться с http(s):// и быть короче 500 символов" }, { status: 400 });
    } else {
      update.channel_post_url = raw;
    }
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bots").update(update).eq("id", body.id).select("id, max_bot_username, channel_post_url").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true, bot: data });
}
