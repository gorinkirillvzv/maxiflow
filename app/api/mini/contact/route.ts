// Mini App endpoint: сохраняем номер телефона юзера, который дал WebApp.requestContact().
// MAX возвращает { phone, authDate, hash } — hash = HMAC_SHA256(authDate + phone + userId, bot_token).
// Валидация HMAC гарантирует что данные не подделаны на клиенте.
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeDecrypt } from "@/lib/crypto";
import { createHmac } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizePhone(raw: string): string {
  // MAX присылает "+7**********" в маскированном виде для превью в редакторе,
  // но реальный контакт — полный номер. Убираем всё кроме цифр и +.
  return raw.trim().replace(/[^\d+]/g, "").slice(0, 20);
}

export async function POST(request: Request) {
  let body: { bot_id?: unknown; user_id?: unknown; phone?: unknown; auth_date?: unknown; hash?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Bad request" }, { status: 400 }); }

  const botId = typeof body.bot_id === "string" ? body.bot_id : "";
  const userId = typeof body.user_id === "number" ? body.user_id
                 : typeof body.user_id === "string" ? Number(body.user_id) : null;
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  const authDate = typeof body.auth_date === "string" ? body.auth_date : "";
  const hashHex = typeof body.hash === "string" ? body.hash : "";
  if (!botId || !userId || !phone || !authDate || !hashHex) {
    return Response.json({ error: "Нужны bot_id, user_id, phone, auth_date, hash" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: bot } = await admin
    .from("bots").select("bot_token, tenant_id").eq("id", botId).maybeSingle();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });
  const token = maybeDecrypt(bot.bot_token);
  if (!token) return Response.json({ error: "Токен бота недоступен" }, { status: 500 });

  // HMAC-верификация: hash = HMAC_SHA256(authDate + phone + userId, botToken)
  const payload = `${authDate}${phone}${userId}`;
  const expected = createHmac("sha256", token).update(payload).digest("hex");
  if (expected !== hashHex) {
    return Response.json({ error: "Некорректная подпись" }, { status: 403 });
  }

  // Найти / создать лид, сохранить телефон
  const { data: existingLead } = await admin
    .from("leads")
    .select("id, phone")
    .eq("bot_id", botId).eq("max_user_id", userId).maybeSingle();

  if (existingLead) {
    if (existingLead.phone !== phone) {
      await admin.from("leads")
        .update({ phone, phone_collected_at: new Date().toISOString() })
        .eq("id", existingLead.id);
    }
  } else {
    await admin.from("leads").insert({
      tenant_id: bot.tenant_id,
      bot_id: botId,
      max_user_id: userId,
      phone,
      phone_collected_at: new Date().toISOString(),
    });
  }

  return Response.json({ ok: true });
}
