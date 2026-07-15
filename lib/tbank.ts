// Maxiflow — клиент интернет-эквайринга Т-Банк (Tinkoff Acquiring API v2).
// Доступы из ЛК эквайринга Т-Бизнес: TBANK_TERMINAL_KEY, TBANK_PASSWORD.
import { createHash } from "crypto";

const API = "https://securepay.tinkoff.ru/v2";

function terminalKey(): string { return process.env.TBANK_TERMINAL_KEY ?? ""; }
function password(): string { return process.env.TBANK_PASSWORD ?? ""; }

/** Настроен ли эквайринг (есть ли доступы банка). */
export function tbankConfigured(): boolean {
  return !!terminalKey() && !!password();
}

/**
 * Подпись запроса/уведомления Т-Банка: SHA-256 от значений корневых
 * скалярных полей (+ Password), отсортированных по имени ключа.
 * Вложенные объекты (Receipt, DATA) и сам Token в подписи не участвуют.
 */
export function buildToken(body: Record<string, unknown>): string {
  const fields: Record<string, string> = { Password: password() };
  for (const [k, v] of Object.entries(body)) {
    if (k === "Token") continue;
    if (v === null || v === undefined) continue;
    // вложенные объекты (DATA/Receipt/Shops в запросе) в подписи не участвуют;
    // в уведомлении DATA приходит строкой и в подписи участвует.
    if (typeof v === "object") continue;
    fields[k] = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  }
  const concat = Object.keys(fields).sort().map((k) => fields[k]).join("");
  return createHash("sha256").update(concat).digest("hex");
}

export type InitResult = {
  ok: boolean;
  paymentUrl?: string;
  paymentId?: string;
  error?: string;
};

/**
 * Создаёт платёж. recurrent=true сохраняет карту для будущих автосписаний
 * (в уведомлении об оплате придёт RebillId).
 */
export async function tbankInit(opts: {
  orderId: string;
  amount: number;        // в копейках
  description: string;
  customerKey: string;   // стабильный id клиента (tenant_id) — для рекуррента
  recurrent: boolean;
  successUrl: string;
  failUrl: string;
  notificationUrl: string;
}): Promise<InitResult> {
  if (!tbankConfigured()) {
    return { ok: false, error: "Приём оплаты ещё не подключён. Свяжитесь с поддержкой." };
  }

  const body: Record<string, unknown> = {
    TerminalKey: terminalKey(),
    Amount: opts.amount,
    OrderId: opts.orderId,
    Description: opts.description,
    CustomerKey: opts.customerKey,
    SuccessURL: opts.successUrl,
    FailURL: opts.failUrl,
    NotificationURL: opts.notificationUrl,
  };
  if (opts.recurrent) body.Recurrent = "Y";
  body.Token = buildToken(body);

  try {
    const r = await fetch(`${API}/Init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.Success) {
      return { ok: true, paymentUrl: d.PaymentURL, paymentId: String(d.PaymentId) };
    }
    return { ok: false, error: d.Message || d.Details || "Т-Банк отклонил платёж" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Сетевая ошибка" };
  }
}

/** Проверка подписи входящего webhook-уведомления Т-Банка. */
export function verifyNotification(payload: Record<string, unknown>): boolean {
  const incoming = payload.Token;
  if (typeof incoming !== "string" || !password()) return false;
  return buildToken(payload) === incoming;
}
