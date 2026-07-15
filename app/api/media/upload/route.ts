// Загрузка медиа из браузера в MAX без пересылки боту.
// Поток: multipart-форма с file/bot_id/kind → дёргаем MAX /uploads?type=<kind> →
// получаем upload URL → POST'им файл туда → достаём token → сохраняем в media_assets.
//
// Для картинок дополнительно кладём файл в Supabase Storage (bucket "media") —
// MAX не отдаёт публичной HTTPS-ссылки на превью, но она нужна Mini App / лендингам
// для рендера в браузере. Сохраняем URL в media_assets.thumbnail_url.
//
// MAX upload kinds: image | video | audio | file (video_note и sticker не загружаются
// через этот endpoint — только через пересылку боту).
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeDecrypt } from "@/lib/crypto";

const UPLOADABLE_KINDS = new Set(["image", "video", "audio", "file"]);
const MAX_API_BASE = "https://botapi.max.ru";

type UploadInit = { url: string; token?: string };

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "Bad multipart" }, { status: 400 }); }

  const file = form.get("file");
  const botId = typeof form.get("bot_id") === "string" ? (form.get("bot_id") as string) : "";
  const kind = typeof form.get("kind") === "string" ? (form.get("kind") as string) : "";

  if (!(file instanceof File) || !botId || !UPLOADABLE_KINDS.has(kind)) {
    return Response.json({ error: "Нужен file, bot_id и kind (image|video|audio|file)" }, { status: 400 });
  }
  if (file.size === 0) return Response.json({ error: "Пустой файл" }, { status: 400 });
  // soft-лимит на стороне нас — MAX позволяет до 4 GB, но через REST-прокси держим скромнее.
  const MAX_SIZE = 200 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return Response.json({ error: `Файл больше ${MAX_SIZE / 1024 / 1024} МБ` }, { status: 413 });
  }

  // Бот арендатора (RLS по auth.getUser сам ограничит)
  const { data: bot } = await supabase
    .from("bots").select("id, tenant_id, bot_token").eq("id", botId).maybeSingle();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });
  const botToken = maybeDecrypt(bot.bot_token);
  if (!botToken) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });

  // Шаг 1: получить upload URL
  const initRes = await fetch(`${MAX_API_BASE}/uploads?type=${kind}`, {
    method: "POST",
    headers: { Authorization: botToken, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  let initBody: UploadInit | { code?: string; message?: string } = {} as UploadInit;
  try { initBody = await initRes.json(); } catch { /* ignore */ }
  if (!initRes.ok || !("url" in initBody) || !initBody.url) {
    const detail = "message" in initBody ? initBody.message : String(initRes.status);
    return Response.json({ error: `MAX upload init: ${detail}` }, { status: 502 });
  }

  let mediaToken: string | null = ("token" in initBody && initBody.token) ? initBody.token : null;

  // Шаг 2: загрузить файл на полученный URL (multipart, поле "data")
  const uploadFd = new FormData();
  uploadFd.append("data", file, file.name);
  const upRes = await fetch(initBody.url, {
    method: "POST",
    body: uploadFd,
  });
  let upBody: Record<string, unknown> = {};
  try { upBody = await upRes.json(); } catch { /* ignore */ }
  if (!upRes.ok) {
    return Response.json({ error: `MAX upload: ${upRes.status}`, detail: upBody }, { status: 502 });
  }

  // Достаём токен из ответа загрузки (для image и file он именно здесь).
  // Формат MAX для картинок — объект-словарь photos: { "<photo_id>": { token: "..." } }.
  // Для file/video/audio может быть плоское поле token.
  if (!mediaToken) {
    const candidate = upBody.token ?? upBody.photo_token ?? upBody.file_id ?? upBody.id ?? null;
    if (typeof candidate === "string" && candidate) mediaToken = candidate;
    else if (upBody.photos && typeof upBody.photos === "object") {
      // Формат для картинок: { photos: { "<photo_id>": { token } } }
      const photosDict = upBody.photos as Record<string, Record<string, unknown>>;
      const values = Array.isArray(photosDict) ? photosDict : Object.values(photosDict);
      for (const ph of values) {
        if (!ph || typeof ph !== "object") continue;
        const t = (ph as Record<string, unknown>).token
          ?? (ph as Record<string, unknown>).photo_token
          ?? (ph as Record<string, unknown>).id;
        if (typeof t === "string" && t) { mediaToken = t; break; }
      }
    }
  }

  if (!mediaToken) {
    return Response.json({ error: "MAX не вернул токен после загрузки", detail: upBody }, { status: 502 });
  }

  // Для картинок — сохраняем публичную HTTPS-версию в Supabase Storage.
  // MAX не отдаёт публичной ссылки на превью, а Mini App нужна валидная URL.
  let thumbnailUrl: string | null = null;
  if (kind === "image") {
    try {
      const admin = createAdminClient();
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const key = `${bot.tenant_id}/${bot.id}/${crypto.randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from("media")
        .upload(key, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
      if (!upErr) {
        const { data: pub } = admin.storage.from("media").getPublicUrl(key);
        thumbnailUrl = pub?.publicUrl ?? null;
      }
    } catch (e) {
      console.error("supabase storage upload failed", e);
    }
  }

  // Сохраняем в библиотеку
  const { data: asset, error: assetErr } = await supabase
    .from("media_assets").insert({
      tenant_id: bot.tenant_id,
      bot_id: bot.id,
      kind,
      token: mediaToken,
      name: file.name,
      size_bytes: file.size,
      thumbnail_url: thumbnailUrl,
    })
    .select("id, bot_id, kind, token, name, thumbnail_url, duration_sec, size_bytes, created_at")
    .single();
  if (assetErr) return Response.json({ error: assetErr.message }, { status: 500 });

  return Response.json({ asset });
}
