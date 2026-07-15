"use client";
// Maxiflow — онлайн-чат: 3-pane layout (список ↔ переписка ↔ карточка контакта).
// Включены system events воронки в треде сообщений + поиск + заметка оператора.
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui";

type Convo = {
  bot_id: string; max_user_id: number; name: string;
  last_text: string; last_direction: string; last_at: string;
};
type Msg = { direction: string; text: string; created_at: string };
type LeadInfo = {
  id: string;
  max_username: string | null;
  first_name: string | null;
  last_name: string | null;
  yclid: string | null;
  direct_campaign_name: string | null;
  direct_campaign_id: string | null;
  first_seen_at: string;
  subscribed_at: string | null;
  magnet_sent_at: string | null;
  unsubscribed_at: string | null;
  unsubscribed_reason: string | null;
  conversion_sent_at: string | null;
  operator_note: string | null;
  conversation_closed_at: string | null;
  ad_sources?: { name: string } | null;
};
type TagItem = { id: string; name: string; color: string };
type Filter = "open" | "closed" | "all";

// смешанная сущность для рендера треда — либо реальное сообщение, либо системное событие
type TimelineItem =
  | { kind: "msg"; at: string; direction: string; text: string }
  | { kind: "event"; at: string; emoji: string; label: string };

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
function fmtRel(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function leadName(l: { first_name: string | null; last_name: string | null; max_username: string | null } | null): string {
  if (!l) return "—";
  const n = [l.first_name, l.last_name].filter(Boolean).join(" ");
  return n || (l.max_username ? `@${l.max_username}` : "—");
}

function buildTimeline(messages: Msg[], lead: LeadInfo | null): TimelineItem[] {
  const items: TimelineItem[] = messages.map((m) => ({
    kind: "msg", at: m.created_at, direction: m.direction, text: m.text,
  }));
  if (lead) {
    const events: { at: string | null; emoji: string; label: string }[] = [
      { at: lead.first_seen_at, emoji: "🚪", label: "Зашёл в бота" },
      { at: lead.subscribed_at, emoji: "📣", label: "Подписался на канал" },
      { at: lead.magnet_sent_at, emoji: "🎁", label: "Получил лид-магнит" },
      { at: lead.conversion_sent_at, emoji: "🎯", label: "Конверсия отправлена в Метрику" },
      { at: lead.unsubscribed_at, emoji: "🚪",
        label: lead.unsubscribed_reason === "blocked_bot" ? "Заблокировал бота" : "Отписался от канала" },
    ];
    for (const e of events) {
      if (e.at) items.push({ kind: "event", at: e.at, emoji: e.emoji, label: e.label });
    }
  }
  items.sort((a, b) => a.at.localeCompare(b.at));
  return items;
}

export default function ChatPage() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [active, setActive] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [leadTags, setLeadTags] = useState<TagItem[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const d = await fetch("/api/inbox").then((r) => r.json());
    setConvos(d.conversations ?? []);
    setLoadingList(false);
  }, []);

  const loadConvo = useCallback(async (c: Convo) => {
    setActive(c);
    setMessages([]);
    setLead(null);
    setLeadTags([]);
    const d = await fetch(`/api/inbox?bot=${c.bot_id}&user=${c.max_user_id}`).then((r) => r.json());
    setMessages(d.messages ?? []);
    setLead(d.lead ?? null);
    setLeadTags(d.tags ?? []);
    setNoteDraft(d.lead?.operator_note ?? "");
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages, lead]);

  async function send() {
    if (!active || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setError(null);
    setMessages((m) => [...m, { direction: "out", text, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const r = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: active.bot_id, max_user_id: active.max_user_id, text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSending(false);
    }
  }

  async function saveNote() {
    if (!active) return;
    setSavingNote(true);
    try {
      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: active.bot_id, max_user_id: active.max_user_id,
          operator_note: noteDraft,
        }),
      });
      setLead((l) => l ? { ...l, operator_note: noteDraft } : l);
    } finally {
      setSavingNote(false);
    }
  }

  async function toggleClosed() {
    if (!active || !lead) return;
    const newClosed = !lead.conversation_closed_at;
    await fetch("/api/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bot_id: active.bot_id, max_user_id: active.max_user_id,
        closed: newClosed,
      }),
    });
    setLead({ ...lead, conversation_closed_at: newClosed ? new Date().toISOString() : null });
    loadList();
  }

  // фильтрация списка
  const shown = convos.filter((c) => {
    if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const timeline = buildTimeline(messages, lead);

  return (
    <Shell active="chat" title="Онлайн-чат" breadcrumbs={["Автоматизация", "Онлайн-чат"]}>
      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>

        {/* ───── список диалогов ───── */}
        <div style={{ width: 320, borderRight: "1px solid var(--n-100)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--n-100)" }}>
            <div className="kk-row kk-gap-2" style={{ height: 36, padding: "0 10px", borderRadius: 9, background: "var(--n-50)", marginBottom: 8 }}>
              <Icon name="search" size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени"
                style={{ border: 0, background: "transparent", outline: "none", flex: 1, fontSize: 13 }} />
            </div>
            <div className="kk-tabs">
              {[
                { id: "open" as Filter,   label: "Активные" },
                { id: "closed" as Filter, label: "Закрытые" },
                { id: "all" as Filter,    label: "Все" },
              ].map((t) => (
                <button key={t.id} className="kk-tab" data-active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>

          <div className="kk-scroll" style={{ flex: 1, overflow: "auto" }}>
            {loadingList ? (
              <div className="kk-muted kk-sm" style={{ padding: 20 }}>Загрузка…</div>
            ) : shown.length === 0 ? (
              <div className="kk-muted kk-sm" style={{ padding: 20, textAlign: "center" }}>
                Диалогов пока нет.
              </div>
            ) : (
              shown.map((c) => {
                const isActive = active?.max_user_id === c.max_user_id && active?.bot_id === c.bot_id;
                return (
                  <button key={`${c.bot_id}:${c.max_user_id}`} onClick={() => loadConvo(c)}
                    className="kk-row kk-gap-3"
                    style={{
                      width: "100%", padding: "12px 16px", border: 0, cursor: "pointer", textAlign: "left",
                      background: isActive ? "var(--brand-violet-12)" : "transparent",
                      borderBottom: "1px solid var(--n-100)",
                    }}>
                    <Avatar initials={c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 2 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <div className="kk-xs kk-muted">{fmtDate(c.last_at)}</div>
                      </div>
                      <div className="kk-xs kk-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.last_direction === "out" ? "Вы: " : ""}{c.last_text}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ───── переписка ───── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--n-25)" }}>
          {!active ? (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--n-500)" }}>
              <div style={{ textAlign: "center" }}>
                <Icon name="emoji" size={28} stroke="var(--n-300)" />
                <div className="kk-sm" style={{ marginTop: 8 }}>Выбери диалог слева</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--n-100)", background: "var(--n-0)" }}>
                <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{active.name}</div>
                  {lead && (
                    <button className="kk-btn kk-btn-outline kk-btn-sm" onClick={toggleClosed}>
                      {lead.conversation_closed_at ? "Открыть снова" : "Закрыть диалог"}
                    </button>
                  )}
                </div>
              </div>
              <div className="kk-scroll" style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
                {timeline.map((item, i) => (
                  item.kind === "event" ? (
                    <div key={i} className="kk-row" style={{ justifyContent: "center", margin: "12px 0" }}>
                      <div className="kk-xs kk-muted" style={{
                        padding: "4px 12px", background: "var(--n-100)", borderRadius: 99,
                      }}>
                        {item.emoji} {item.label} · {fmtTime(item.at)}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="kk-row" style={{ justifyContent: item.direction === "out" ? "flex-end" : "flex-start", marginBottom: 8 }}>
                      <div style={{ maxWidth: "70%" }}>
                        <div style={{
                          padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap",
                          background: item.direction === "out" ? "var(--brand-violet)" : "var(--n-0)",
                          color: item.direction === "out" ? "#fff" : "var(--brand-ink)",
                          boxShadow: item.direction === "out" ? "none" : "var(--shadow-card)",
                        }}>
                          {item.text}
                        </div>
                        <div className="kk-xs kk-muted" style={{
                          marginTop: 2, textAlign: item.direction === "out" ? "right" : "left", padding: "0 6px",
                        }}>{fmtTime(item.at)}</div>
                      </div>
                    </div>
                  )
                ))}
                <div ref={endRef} />
              </div>
              {error && (
                <div className="kk-sm" style={{ margin: "0 20px 6px", color: "var(--danger)" }}>{error}</div>
              )}
              {lead?.unsubscribed_at ? (
                <div className="kk-sm kk-muted" style={{ padding: "12px 20px", borderTop: "1px solid var(--n-100)", background: "var(--n-50)", textAlign: "center" }}>
                  Подписчик {lead.unsubscribed_reason === "blocked_bot" ? "заблокировал бота" : "отписался от канала"}. Сообщения не доставятся.
                </div>
              ) : (
                <div className="kk-row kk-gap-2" style={{ padding: "12px 20px", borderTop: "1px solid var(--n-100)", background: "var(--n-0)" }}>
                  <input className="kk-input" style={{ flex: 1 }}
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
                    placeholder="Ответить подписчику…" disabled={sending} />
                  <button className="kk-btn kk-btn-accent" onClick={send} disabled={sending || !input.trim()}
                    style={{ opacity: sending || !input.trim() ? 0.6 : 1 }}>
                    <Icon name="send" size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ───── карточка контакта ───── */}
        {active && lead && (
          <div className="kk-scroll" style={{ width: 320, borderLeft: "1px solid var(--n-100)", overflow: "auto", flexShrink: 0, background: "var(--n-0)" }}>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
                <Avatar initials={active.name.split(" ").map((n) => n[0]).join("").slice(0, 2)} size={60} />
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 10, textAlign: "center" }}>
                  {leadName(lead)}
                </div>
                {lead.max_username && (
                  <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>@{lead.max_username}</div>
                )}
                <div style={{ marginTop: 10 }}>
                  {lead.unsubscribed_at ? (
                    <span className="kk-chip kk-chip-coral" style={{ height: 22 }}>
                      {lead.unsubscribed_reason === "blocked_bot" ? "Заблокировал" : "Отписался"}
                    </span>
                  ) : lead.conversion_sent_at ? (
                    <span className="kk-chip kk-chip-violet" style={{ height: 22 }}>Конверсия</span>
                  ) : lead.magnet_sent_at ? (
                    <span className="kk-chip kk-chip-amber" style={{ height: 22 }}>Магнит получен</span>
                  ) : lead.subscribed_at ? (
                    <span className="kk-chip kk-chip-green" style={{ height: 22 }}>Подписан</span>
                  ) : (
                    <span className="kk-chip" style={{ height: 22 }}>Зашёл</span>
                  )}
                </div>
              </div>

              <Section label="Источник">
                {lead.yclid ? (
                  <>
                    <Field label="Реклама" value={lead.direct_campaign_name ?? "Яндекс.Директ"} />
                    {lead.direct_campaign_id && <Field label="Кампания #" value={lead.direct_campaign_id} mono />}
                    <Field label="yclid" value={lead.yclid} mono />
                  </>
                ) : lead.ad_sources?.name ? (
                  <Field label="Источник" value={lead.ad_sources.name} />
                ) : (
                  <Field label="Источник" value="Органика" muted />
                )}
              </Section>

              <Section label="Хронология">
                <Field label="Первый заход" value={fmtRel(lead.first_seen_at)} />
                {lead.subscribed_at && <Field label="Подписался" value={fmtRel(lead.subscribed_at)} />}
                {lead.magnet_sent_at && <Field label="Магнит выдан" value={fmtRel(lead.magnet_sent_at)} />}
                {lead.conversion_sent_at && <Field label="Конверсия" value={fmtRel(lead.conversion_sent_at)} />}
                {lead.unsubscribed_at && <Field label="Отписался" value={fmtRel(lead.unsubscribed_at)} />}
              </Section>

              {leadTags.length > 0 && (
                <Section label="Теги">
                  <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                    {leadTags.map((t) => (
                      <span key={t.id} className="kk-chip" style={{ height: 22, fontSize: 11 }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              <Section label="Заметка оператора">
                <textarea className="kk-input" rows={3}
                  value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Например: интересуется банкротством, перезвонить во вторник"
                  style={{ width: "100%", padding: 10, resize: "vertical" }} />
                {noteDraft !== (lead.operator_note ?? "") && (
                  <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={saveNote} disabled={savingNote}
                    style={{ marginTop: 6 }}>
                    {savingNote ? "Сохраняю…" : "Сохранить заметку"}
                  </button>
                )}
              </Section>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="kk-xs kk-muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div className="kk-row" style={{ justifyContent: "space-between", padding: "5px 0", gap: 8 }}>
      <div className="kk-xs kk-muted">{label}</div>
      <div style={{
        fontSize: 12.5,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        color: muted ? "var(--n-500)" : "var(--brand-ink)",
        textAlign: "right",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        maxWidth: 180,
      }}>{value}</div>
    </div>
  );
}
