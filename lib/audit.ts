// Журнал критичных действий. Пишем через service_role (минуем RLS),
// клиенту видны только записи своего тенанта через select-policy.
//
// Использование:
//   await audit(supabase, request, {
//     tenantId, action: "bot.delete", targetType: "bot", targetId: id,
//     before: oldRow,
//   });
// Никогда не бросает — если запись упала, основное действие не должно ломаться.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { clientIp } from "./rate-limit";

export type AuditEntry = {
  tenantId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function audit(
  supabase: SupabaseClient,
  request: Request,
  entry: AuditEntry,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      tenant_id: entry.tenantId,
      actor_user_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      before_state: entry.before ?? null,
      after_state: entry.after ?? null,
      ip: clientIp(request),
      user_agent: request.headers.get("user-agent")?.slice(0, 256) ?? null,
    });
  } catch (e) {
    console.error("audit log write failed:", e);
  }
}
