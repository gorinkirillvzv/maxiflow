"use client";
// Maxiflow — таблица подписчиков (лиды бота) с фильтрами, поиском и тегами.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Avatar } from "./ui";
import { tagStyle } from "@/lib/tagColors";

export type SubLead = {
  id: string;
  max_user_id: number;
  max_username: string | null;
  first_name: string | null;
  last_name: string | null;
  yclid: string | null;
  utm_campaign: string | null;
  direct_campaign_id: string | null;
  direct_campaign_name: string | null;
  first_seen_at: string;
  subscribed_at: string | null;
  magnet_sent_at: string | null;
  unsubscribed_at: string | null;
  unsubscribed_reason: string | null;
  conversion_status: string | null;
  conversion_sent_at: string | null;
};

export type TagDef = { id: string; name: string; color: string };

const AV_COLORS = ["#5B47FB", "#FF6B57", "#00B956", "#FFB020", "#3A78FF", "#9333EA"];

function fullName(l: SubLead): string {
  const n = [l.first_name, l.last_name].filter(Boolean).join(" ");
  return n || (l.max_username ? `@${l.max_username}` : `id${l.max_user_id}`);
}
function initials(l: SubLead): string {
  const parts = [l.first_name, l.last_name].filter(Boolean) as string[];
  if (parts.length) return parts.map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (l.max_username?.[0] ?? "?").toUpperCase();
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function stageOf(l: SubLead): { label: string; cls: string } {
  if (l.unsubscribed_at) {
    const r = l.unsubscribed_reason;
    const lbl = r === "blocked_bot" ? "Заблокировал" : r === "left_channel" ? "Ушёл из канала" : "Отписался";
    return { label: lbl, cls: "kk-chip-coral" };
  }
  if (l.conversion_sent_at) return { label: "Конверсия", cls: "kk-chip-violet" };
  if (l.magnet_sent_at) return { label: "Магнит", cls: "kk-chip-amber" };
  if (l.subscribed_at) return { label: "Подписан", cls: "kk-chip-green" };
  return { label: "Зашёл", cls: "" };
}
const CONV: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "Отправлена", cls: "kk-chip-green" },
  pending:  { label: "В очереди",  cls: "kk-chip-amber" },
  error:    { label: "Ошибка",     cls: "kk-chip-coral" },
  skipped:  { label: "Пропущена",  cls: "" },
};

const FILTERS = [
  { id: "all",          label: "Все" },
  { id: "ads",          label: "С рекламы" },
  { id: "subscribed",   label: "Подписаны" },
  { id: "unsubscribed", label: "Отписались" },
  { id: "converted",    label: "Конверсии" },
];

export function SubscribersTable({
  leads, tags, leadTagMap,
}: {
  leads: SubLead[];
  tags: TagDef[];
  leadTagMap: Record<string, string[]>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState<string>(""); // "" = все
  const [popoverLead, setPopoverLead] = useState<string | null>(null);

  // локальный мутируемый снимок (для мгновенного UI без перезагрузки страницы)
  const [localTagMap, setLocalTagMap] = useState<Record<string, string[]>>(leadTagMap);

  async function toggleTag(leadId: string, tagId: string) {
    const current = localTagMap[leadId] ?? [];
    const has = current.includes(tagId);
    // оптимистичный апдейт
    setLocalTagMap((m) => ({
      ...m,
      [leadId]: has ? current.filter((x) => x !== tagId) : [...current, tagId],
    }));
    try {
      if (has) {
        await fetch(`/api/lead-tags?lead_id=${leadId}&tag_id=${tagId}`, { method: "DELETE" });
      } else {
        await fetch("/api/lead-tags", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, tag_id: tagId }),
        });
      }
      router.refresh();
    } catch {
      // откат при ошибке
      setLocalTagMap((m) => ({ ...m, [leadId]: current }));
    }
  }

  const tagsById: Record<string, TagDef> = Object.fromEntries(tags.map((t) => [t.id, t]));

  const shown = leads.filter((l) => {
    if (filter === "ads" && !l.yclid) return false;
    if (filter === "subscribed" && (!l.subscribed_at || l.unsubscribed_at)) return false;
    if (filter === "unsubscribed" && !l.unsubscribed_at) return false;
    if (filter === "converted" && !l.conversion_sent_at) return false;
    if (tagFilter && !(localTagMap[l.id] ?? []).includes(tagFilter)) return false;
    if (q.trim()) {
      const hay = `${fullName(l)} ${l.max_username ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="kk-card" style={{ overflow: "hidden" }}>
      <div className="kk-row kk-gap-3" style={{ padding: "12px 16px", borderBottom: "1px solid var(--n-100)", flexWrap: "wrap" }}>
        <div className="kk-tabs">
          {FILTERS.map((f) => (
            <button key={f.id} className="kk-tab" data-active={filter === f.id}
              onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        {tags.length > 0 && (
          <select className="kk-input kk-btn-sm" style={{ minWidth: 160 }}
            value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Все теги</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <div className="kk-row kk-gap-2" style={{
          height: 34, padding: "0 10px", borderRadius: 9, background: "var(--n-50)",
          flex: 1, minWidth: 160, maxWidth: 280, marginLeft: "auto",
        }}>
          <Icon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени…"
            style={{ border: 0, background: "transparent", outline: "none", flex: 1, fontSize: 13, minWidth: 0 }} />
        </div>
      </div>

      <div className="kk-scroll" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 900 }}>
          <div className="kk-row" style={{
            padding: "8px 16px", borderBottom: "1px solid var(--n-100)",
            fontSize: 11, fontWeight: 600, color: "var(--n-400)",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            <div style={{ flex: "2 1 0", minWidth: 180 }}>Подписчик</div>
            <div style={{ flex: "2 1 0", minWidth: 180 }}>Теги</div>
            <div style={{ flex: "1 1 0", minWidth: 96 }}>Источник</div>
            <div style={{ flex: "1 1 0", minWidth: 96 }}>Этап</div>
            <div style={{ flex: "1 1 0", minWidth: 120 }}>Кампания</div>
            <div style={{ flex: "1 1 0", minWidth: 110 }}>Когда</div>
          </div>

          {shown.length === 0 ? (
            <div className="kk-muted kk-sm" style={{ padding: 40, textAlign: "center" }}>
              {leads.length === 0 ? "Пока нет подписчиков." : "Ничего не найдено."}
            </div>
          ) : shown.map((l, i) => {
            const st = stageOf(l);
            const leadTagIds = localTagMap[l.id] ?? [];
            return (
              <div key={l.id} className="kk-row" style={{
                padding: "10px 16px", borderBottom: "1px solid var(--n-50)", fontSize: 13,
              }}>
                <div className="kk-row kk-gap-2" style={{ flex: "2 1 0", minWidth: 180 }}>
                  <Avatar initials={initials(l)} color={AV_COLORS[i % AV_COLORS.length]} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fullName(l)}
                    </div>
                    {l.max_username && <div className="kk-xs kk-muted">@{l.max_username}</div>}
                  </div>
                </div>

                {/* теги */}
                <div style={{ flex: "2 1 0", minWidth: 180, position: "relative" }}>
                  <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                    {leadTagIds.map((tid) => {
                      const t = tagsById[tid];
                      if (!t) return null;
                      return (
                        <span key={tid} className="kk-chip" style={{ ...tagStyle(t.color), height: 20, fontSize: 11, padding: "0 4px 0 8px" }}>
                          {t.name}
                          <button onClick={() => toggleTag(l.id, tid)}
                            style={{ background: "none", border: 0, cursor: "pointer", padding: 0, marginLeft: 4, color: "inherit", opacity: 0.7, fontSize: 14, lineHeight: 1 }}
                            aria-label="убрать">×</button>
                        </span>
                      );
                    })}
                    {tags.length > 0 && (
                      <button
                        onClick={() => setPopoverLead(popoverLead === l.id ? null : l.id)}
                        className="kk-chip"
                        style={{ height: 20, fontSize: 11, padding: "0 7px", background: "var(--n-100)", color: "var(--n-500)", cursor: "pointer", border: 0 }}>
                        + тег
                      </button>
                    )}
                  </div>
                  {popoverLead === l.id && (
                    <>
                      <div onClick={() => setPopoverLead(null)}
                        style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                      <div style={{
                        position: "absolute", top: 26, left: 0, zIndex: 50,
                        width: 220, maxHeight: 240, overflowY: "auto",
                        background: "var(--n-0)", borderRadius: 10, boxShadow: "var(--shadow-pop)", padding: 6,
                      }}>
                        {tags.map((t) => {
                          const checked = leadTagIds.includes(t.id);
                          return (
                            <button key={t.id} onClick={() => toggleTag(l.id, t.id)}
                              className="kk-row kk-gap-2"
                              style={{ width: "100%", padding: "6px 8px", border: 0, background: "transparent", cursor: "pointer", borderRadius: 6, textAlign: "left" }}>
                              <span style={{
                                width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                                background: checked ? "var(--brand-violet)" : "var(--n-0)",
                                border: checked ? "0" : "1.5px solid var(--n-300)",
                                display: "grid", placeItems: "center",
                              }}>
                                {checked && <Icon name="check" size={10} stroke="#fff" strokeWidth={3} />}
                              </span>
                              <span className="kk-chip" style={{ ...tagStyle(t.color), height: 20, fontSize: 11, padding: "0 8px" }}>{t.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ flex: "1 1 0", minWidth: 96 }}>
                  {l.yclid
                    ? <span className="kk-chip kk-chip-coral" style={{ height: 22 }}>Реклама</span>
                    : <span className="kk-chip" style={{ height: 22 }}>Органика</span>}
                </div>
                <div style={{ flex: "1 1 0", minWidth: 96 }}>
                  <span className={`kk-chip ${st.cls}`} style={{ height: 22 }}>{st.label}</span>
                </div>
                <div className="kk-sm" style={{ flex: "1 1 0", minWidth: 120, color: "var(--n-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={l.direct_campaign_name || l.direct_campaign_id || l.utm_campaign || ""}>
                  {l.direct_campaign_name || l.utm_campaign || (l.direct_campaign_id ? `#${l.direct_campaign_id}` : "—")}
                </div>
                <div className="kk-xs" style={{ flex: "1 1 0", minWidth: 110, color: "var(--n-500)" }}>
                  {fmtDate(l.first_seen_at)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="kk-row" style={{ padding: "10px 16px", borderTop: "1px solid var(--n-100)", color: "var(--n-500)", fontSize: 12 }}>
        Показано {shown.length} из {leads.length}
      </div>
    </div>
  );
}
