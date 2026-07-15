// Mini App: GET (список ботов юзера + их mini_app_config),
// PATCH (обновить bots.mini_app_config для конкретного бота).
// Один Mini App на бота — редактируем в контексте bot_id.
// RLS сам ограничит выборку арендатором пользователя.
// Поле mini_app_blocks оставлено в БД для отката, но не используется в новой логике.
import { createClient } from "@/lib/supabase/server";
import type { MiniAppConfig } from "@/lib/mini-app/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data, error } = await supabase
    .from("bots")
    .select("id, max_bot_username, channel_id, channel_title, channel_link, is_active, mini_app_config, mini_app_updated_at")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ bots: data ?? [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: { bot_id?: unknown; config?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const botId = typeof body.bot_id === "string" ? body.bot_id : "";
  if (!botId) return Response.json({ error: "Нужен bot_id" }, { status: 400 });
  if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) {
    return Response.json({ error: "config должен быть объектом" }, { status: 400 });
  }
  // Валидируем schema config, чтобы владелец бота не смог сохранить javascript:-URL
  // или другой опасный протокол в ctaUrl/imageUrl (XSS против собственных визитёров).
  const raw = body.config as Record<string, unknown>;
  const safeUrl = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    const s = v.trim();
    if (!s) return undefined;
    // Разрешаем только http/https/mailto/tel/max: — никакого javascript: или data:
    if (!/^(https?:\/\/|mailto:|tel:|max:\/\/)/i.test(s)) return undefined;
    return s.length > 2000 ? s.slice(0, 2000) : s;
  };
  const config: MiniAppConfig = {
    title: typeof raw.title === "string" ? raw.title.slice(0, 200) : "",
    description: typeof raw.description === "string" ? raw.description.slice(0, 2000) : "",
    ctaText: typeof raw.ctaText === "string" ? raw.ctaText.slice(0, 80) : "",
    ctaKind: raw.ctaKind === "channel" || raw.ctaKind === "url" ? raw.ctaKind : "bot",
    ctaStartCommand: typeof raw.ctaStartCommand === "string" ? raw.ctaStartCommand.slice(0, 200) : undefined,
    ctaUrl: safeUrl(raw.ctaUrl),
    imageUrl: safeUrl(raw.imageUrl),
    brandColor: typeof raw.brandColor === "string" && /^#[0-9a-f]{3,8}$/i.test(raw.brandColor) ? raw.brandColor : undefined,
    theme: raw.theme === "light" ? "light" : "dark",
  };

  // RLS пропустит update только если бот принадлежит tenant текущего пользователя.
  const { data, error } = await supabase
    .from("bots")
    .update({
      mini_app_config: config,
      mini_app_updated_at: new Date().toISOString(),
    })
    .eq("id", botId)
    .select("id, mini_app_updated_at")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Бот не найден" }, { status: 404 });

  return Response.json({ ok: true, bot: data });
}
