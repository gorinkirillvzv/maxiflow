// Maxiflow — журнал критичных действий. Видны только записи своего тенанта (RLS).
import { Shell } from "@/components/Shell";
import { SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  before_state: unknown;
  after_state: unknown;
  ip: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  "broadcast.send":           { label: "Запуск рассылки",       cls: "kk-chip-violet" },
  "billing.payment_confirmed":{ label: "Оплата подтверждена",   cls: "kk-chip-green" },
  "landing.delete":           { label: "Удалён лендинг",         cls: "kk-chip-coral" },
  "ad_source.delete":         { label: "Удалён источник",        cls: "kk-chip-coral" },
  "tag.delete":               { label: "Удалён тег",             cls: "kk-chip-coral" },
  "funnel.delete":            { label: "Удалена воронка",        cls: "kk-chip-coral" },
  "bot_admin.unlink":         { label: "Отвязан админ бота",     cls: "kk-chip-amber" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function AuditPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_email, action, target_type, target_id, before_state, after_state, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows: AuditRow[] = data ?? [];

  return (
    <Shell active="audit" title="Журнал событий" breadcrumbs={["Безопасность", "Журнал"]}>
      <div style={{ padding: "20px 24px", maxWidth: 1100 }}>
        <SectionTitle sub="кто и что делал в кабинете за последнее время">Журнал критичных действий</SectionTitle>

        {rows.length === 0 ? (
          <div className="kk-card kk-pad-5 kk-muted kk-sm" style={{ textAlign: "center" }}>
            Записей пока нет. Запиши действие через кабинет (например, удали лендинг), и оно появится здесь.
          </div>
        ) : (
          <div className="kk-card" style={{ overflow: "hidden" }}>
            <div className="kk-row" style={{
              padding: "10px 16px", borderBottom: "1px solid var(--n-100)",
              fontSize: 11, fontWeight: 600, color: "var(--n-400)", textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>
              <div style={{ flex: "0 0 140px" }}>Когда</div>
              <div style={{ flex: "1 1 0", minWidth: 160 }}>Кто</div>
              <div style={{ flex: "0 0 200px" }}>Действие</div>
              <div style={{ flex: "2 1 0", minWidth: 200 }}>Цель</div>
              <div style={{ flex: "0 0 120px" }}>IP</div>
            </div>
            {rows.map((r) => {
              const a = ACTION_LABELS[r.action] ?? { label: r.action, cls: "" };
              return (
                <div key={r.id} className="kk-row" style={{
                  padding: "10px 16px", borderBottom: "1px solid var(--n-50)", fontSize: 13,
                }}>
                  <div className="kk-xs" style={{ flex: "0 0 140px", color: "var(--n-500)" }}>
                    {fmtDate(r.created_at)}
                  </div>
                  <div style={{ flex: "1 1 0", minWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.actor_email ?? "—"}
                  </div>
                  <div style={{ flex: "0 0 200px" }}>
                    <span className={`kk-chip ${a.cls}`} style={{ height: 22 }}>{a.label}</span>
                  </div>
                  <div className="kk-xs" style={{ flex: "2 1 0", minWidth: 200, color: "var(--n-500)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.target_type ? `${r.target_type}:${r.target_id ?? ""}` : "—"}
                  </div>
                  <div className="kk-xs" style={{ flex: "0 0 120px", color: "var(--n-400)", fontFamily: "var(--font-mono)" }}>
                    {r.ip ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
