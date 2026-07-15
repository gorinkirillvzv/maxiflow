// Лендинги: CRUD. Лимит на тариф: trial 3, start 10, business 20, scale 50.
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSubscription, landingLimit } from "@/lib/billing";
import { audit } from "@/lib/audit";
import { createConfirmation } from "@/lib/confirmation";

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const botId = url.searchParams.get("bot_id");

  let q = supabase
    .from("landings")
    .select("id, bot_id, slug, title, subtitle, image_url, button_text, funnel_trigger, goal_name, destination_type, destination_url, is_published, views, clicks, blocks, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (botId) q = q.eq("bot_id", botId);
  const { data } = await q;
  return Response.json({ landings: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }

  const botId = typeof body.bot_id === "string" ? body.bot_id : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!botId || !title) return Response.json({ error: "Нужны bot_id и title" }, { status: 400 });

  const { data: bot } = await supabase.from("bots").select("tenant_id").eq("id", botId).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });

  // лимит на тариф
  const sub = await getOrCreateSubscription(supabase, bot.tenant_id);
  const limit = landingLimit(sub);
  const { count } = await supabase
    .from("landings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", bot.tenant_id);
  if ((count ?? 0) >= limit) {
    return Response.json({
      error: `Тариф «${sub.plan}» позволяет максимум ${limit} лендингов. Обновите тариф или удалите старые.`,
    }, { status: 403 });
  }

  // уникальный slug
  let slug = typeof body.slug === "string" ? slugify(body.slug) : slugify(title);
  if (!slug) slug = `lp-${Math.random().toString(36).slice(2, 8)}`;
  for (let i = 0; i < 10; i++) {
    const { data: exists } = await supabase.from("landings").select("id").eq("slug", slug).maybeSingle();
    if (!exists) break;
    slug = `${slug.replace(/-\d+$/, "")}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const row: Record<string, unknown> = {
    tenant_id: bot.tenant_id,
    bot_id: botId,
    slug,
    title,
    subtitle: typeof body.subtitle === "string" ? body.subtitle : null,
    image_url: typeof body.image_url === "string" ? body.image_url : null,
    button_text: typeof body.button_text === "string" && body.button_text.trim() ? body.button_text.trim() : "Открыть в MAX",
    funnel_trigger: typeof body.funnel_trigger === "string" && body.funnel_trigger.trim() ? body.funnel_trigger.trim() : null,
    goal_name: typeof body.goal_name === "string" && body.goal_name.trim() ? body.goal_name.trim() : null,
    destination_type: body.destination_type === "channel_post" ? "channel_post" : "bot",
    destination_url: typeof body.destination_url === "string" ? body.destination_url : null,
    is_published: body.is_published !== false,
  };
  // Новый блочный конструктор — массив блоков JSON. Старые поля выше сохраняем
  // для обратной совместимости с легаси-рендером /l/[slug].
  if (Array.isArray(body.blocks)) {
    row.blocks = body.blocks;
  }
  const { data, error } = await supabase.from("landings").insert(row).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ landing: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["title", "subtitle", "image_url", "button_text", "funnel_trigger", "goal_name", "destination_type", "destination_url", "is_published"]) {
    if (key in body) patch[key] = body[key];
  }
  if (typeof body.slug === "string") patch.slug = slugify(body.slug);
  // blocks — массив JSON блочного конструктора. null = сброс к легаси-рендеру.
  if ("blocks" in body) {
    if (Array.isArray(body.blocks) || body.blocks === null) {
      patch.blocks = body.blocks;
    }
  }

  const { data, error } = await supabase.from("landings").update(patch).eq("id", id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ landing: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const { data: before } = await supabase.from("landings")
    .select("tenant_id, bot_id, slug, title").eq("id", id).maybeSingle();
  if (!before?.tenant_id) return Response.json({ error: "Лендинг не найден" }, { status: 404 });

  // Опасное действие → отправляем email-подтверждение вместо мгновенного удаления.
  try {
    const { sentTo } = await createConfirmation(supabase, request, {
      tenantId: before.tenant_id,
      action: "landing.delete",
      description: `Удалить лендинг «${before.title}» (/l/${before.slug}). Ссылка на лендинг перестанет работать.`,
      payload: { id },
    });
    return Response.json({
      ok: true,
      requires_confirmation: true,
      sent_to: sentTo,
      message: `На ${sentTo} отправлено письмо. Подтверди в нём, чтобы удалить лендинг.`,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Ошибка отправки подтверждения" }, { status: 500 });
  }
}
