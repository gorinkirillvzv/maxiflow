// Алерты ошибок Maxiflow-инфраструктуры — в ЛС оператору сервиса (тебе),
// а не админам клиентских ботов: клиенты не виноваты в наших багах.
// Кому идёт алерт = env OPERATOR_MAX_USER_ID. Если он не привязан ни к одному
// боту (bot_admins пусто) — алерт молча скипается.
// Дедуп: одна и та же ошибка (по fingerprint) не шлётся чаще раза в 5 минут.
import { createAdminClient } from "./supabase/admin";
import { maxSendMessage } from "./maxApi";
import { maybeDecrypt } from "./crypto";

const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const dedup = new Map<string, number>();

type OperatorRow = {
  bot_id: string;
  dm_chat_id: number | null;
  bots: { bot_token: string | null } | null;
};

export async function sendAdminAlert(
  text: string,
  opts: { fingerprint?: string } = {},
): Promise<{ sent: number; skipped?: string }> {
  const operatorId = process.env.OPERATOR_MAX_USER_ID;
  if (!operatorId) return { sent: 0, skipped: "no_operator_env" };

  if (opts.fingerprint) {
    const last = dedup.get(opts.fingerprint) ?? 0;
    if (Date.now() - last < DEDUP_WINDOW_MS) return { sent: 0, skipped: "dedup" };
    dedup.set(opts.fingerprint, Date.now());
    if (dedup.size > 500) {
      const cutoff = Date.now() - DEDUP_WINDOW_MS;
      for (const [k, v] of dedup) if (v < cutoff) dedup.delete(k);
    }
  }

  const admin = createAdminClient();
  // ищем дм-чат оператора в любом из ботов, где он привязан как админ
  const { data: rows } = await admin
    .from("bot_admins")
    .select("bot_id, dm_chat_id, bots(bot_token)")
    .eq("max_user_id", Number(operatorId))
    .not("dm_chat_id", "is", null);

  const matches = (rows ?? []) as unknown as OperatorRow[];
  if (!matches.length) return { sent: 0, skipped: "operator_not_linked" };

  // достаточно отправить через ОДИН бот — оператор всё равно увидит сообщение.
  // Берём первого с валидным токеном.
  for (const r of matches) {
    const tok = maybeDecrypt(r.bots?.bot_token ?? null);
    if (!tok || !r.dm_chat_id) continue;
    try {
      const res = await maxSendMessage(tok, r.dm_chat_id, text, undefined, "markdown");
      if (res.ok) return { sent: 1 };
    } catch { /* пробуем следующий бот */ }
  }
  return { sent: 0, skipped: "all_sends_failed" };
}
