// Одноразовые подтверждения опасных операций. createConfirmation()
// кладёт токен в БД и шлёт email со ссылкой на /confirm/<token>. На странице
// /confirm юзер видит описание действия и подтверждает → consumeConfirmation()
// возвращает action+payload, который нужно исполнить.
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { clientIp } from "./rate-limit";
import { sendMail } from "./mail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://maxiflow.ru";

export type ConfirmationInput = {
  tenantId: string;
  action: string;
  description: string;            // человеко-понятный текст
  payload: Record<string, unknown>;
};

export async function createConfirmation(
  supabase: SupabaseClient,
  request: Request,
  input: ConfirmationInput,
): Promise<{ token: string; sentTo: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Нет email пользователя для подтверждения");

  const token = randomBytes(24).toString("hex");
  const admin = createAdminClient();
  const { error } = await admin.from("confirmation_tokens").insert({
    token,
    tenant_id: input.tenantId,
    user_id: user.id,
    user_email: user.email,
    action: input.action,
    description: input.description,
    payload: input.payload,
    ip: clientIp(request),
  });
  if (error) throw new Error(error.message);

  const url = `${APP_URL}/confirm/${token}`;
  await sendMail(
    user.email,
    `Подтверждение действия: ${input.description}`,
    renderEmail(input.description, url),
  );
  return { token, sentTo: user.email };
}

export async function consumeConfirmation(token: string): Promise<{
  ok: boolean;
  reason?: string;
  action?: string;
  payload?: Record<string, unknown>;
  tenantId?: string;
  description?: string;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("confirmation_tokens")
    .select("token, tenant_id, action, description, payload, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { ok: false, reason: "Ссылка не существует" };
  if (data.used_at) return { ok: false, reason: "Ссылка уже использована" };
  if (new Date(data.expires_at) <= new Date()) return { ok: false, reason: "Ссылка истекла (час)" };

  await admin.from("confirmation_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  return {
    ok: true,
    action: data.action,
    payload: data.payload as Record<string, unknown>,
    tenantId: data.tenant_id,
    description: data.description,
  };
}

function renderEmail(description: string, url: string): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f5f5f8;padding:24px;color:#15141C">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 6px 20px rgba(0,0,0,0.06)">
    <div style="font-size:22px;font-weight:700;margin-bottom:14px">Подтвердите действие в Maxiflow</div>
    <div style="font-size:15px;line-height:1.5;margin-bottom:24px">${escapeHtml(description)}</div>
    <a href="${url}" style="display:inline-block;padding:14px 24px;background:linear-gradient(135deg,#5B47FB,#7C5CFF);color:#fff;text-decoration:none;border-radius:12px;font-weight:600">Подтвердить</a>
    <div style="font-size:13px;color:#666;margin-top:24px;line-height:1.5">
      Ссылка действует <b>1 час</b> и может быть использована один раз.
      Если вы не запускали это действие — просто проигнорируйте письмо.
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
