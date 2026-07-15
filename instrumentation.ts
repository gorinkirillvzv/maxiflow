// Next.js instrumentation hook. Подгружает sentry-конфиг для нужного runtime,
// и сразу же дублирует ошибки в MAX-бота (DM привязанным админам).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

type ReqInfo = { path: string; method: string; headers: Record<string, string | string[] | undefined> };
type CtxInfo = { routePath?: string; routeType?: string; routerKind?: string };

export async function onRequestError(
  err: unknown,
  request: ReqInfo,
  context: CtxInfo,
): Promise<void> {
  // 1) Sentry (noop без DSN)
  try {
    (Sentry.captureRequestError as unknown as (e: unknown, r: unknown, c: unknown) => void)(err, request, context);
  } catch { /* noop */ }

  // 2) MAX-бот алерт
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // edge не имеет доступа к MAX SDK
  try {
    const { sendAdminAlert } = await import("./lib/alert");
    const e = err as Error;
    const path = request.path || context.routePath || "?";
    const msg = e?.message || String(err);
    const stack = (e?.stack || "").split("\n").slice(0, 6).join("\n").slice(0, 700);
    const text =
      `🚨 *Maxiflow: серверная ошибка*\n` +
      `Путь: \`${path}\`\n` +
      `Ошибка: \`${msg}\`\n\n` +
      (stack ? "```\n" + stack + "\n```" : "");
    await sendAdminAlert(text, { fingerprint: `${path}:${msg}` });
  } catch { /* swallow — алерт ни в коем случае не должен ронять обработку */ }
}
