"use client";
// Maxiflow — каналы: список подключённых ботов + подключение нового.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";

type Bot = { user_id: number; username: string; name: string };
type Channel = { chat_id: number; title: string; link: string | null; participants_count: number | null };
type ConnectedBot = {
  id: string;
  max_bot_username: string;
  channel_title: string | null;
  channel_id: number | null;
  is_active: boolean;
  platform?: "max" | "telegram";
  channel_post_url?: string | null;
};

const STEPS = [
  { n: 1, t: "Создайте бота в MAX", d: "Откройте @MasterBot в MAX, создайте бота и получите его токен." },
  { n: 2, t: "Добавьте бота в канал админом", d: "Сначала добавьте бота в подписчики канала, затем назначьте администратором — права «публиковать» и «читать подписчиков»." },
  { n: 3, t: "Вставьте токен бота ниже", d: "Каскад проверит токен и покажет каналы, где бот — администратор." },
];

export default function ChannelsPage() {
  const router = useRouter();
  const [connected, setConnected] = useState<ConnectedBot[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [token, setToken] = useState("");
  const [bot, setBot] = useState<Bot | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [reenabling, setReenabling] = useState<string | null>(null);
  const [deleteForId, setDeleteForId] = useState<string | null>(null);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [platformTab, setPlatformTab] = useState<"max" | "telegram">("max");

  const loadConnected = useCallback(async () => {
    const d = await fetch("/api/bots").then((r) => r.json());
    setConnected(d.bots ?? []);
  }, []);

  useEffect(() => { loadConnected(); }, [loadConnected]);

  async function disconnect(b: ConnectedBot) {
    if (!confirm(`Запросить отключение бота «${b.channel_title ?? b.max_bot_username}»? На почту придёт письмо для подтверждения.`)) return;
    setError(null); setInfo(null);
    setDisconnecting(b.id);
    try {
      const r = await fetch(`/api/bots?id=${b.id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      if (d.requires_confirmation) {
        setInfo(d.message || `Письмо отправлено на ${d.sent_to}. Подтверди в нём — бот отключится.`);
      } else {
        await loadConnected();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setDisconnecting(null);
    }
  }

  async function reenable(b: ConnectedBot) {
    setError(null); setInfo(null);
    setReenabling(b.id);
    try {
      const r = await fetch("/api/bots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, is_active: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      await loadConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setReenabling(null);
    }
  }

  async function confirmHardDelete(b: ConnectedBot) {
    setError(null); setInfo(null);
    try {
      const r = await fetch(`/api/bots?id=${b.id}&hard=1`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      if (d.requires_confirmation) {
        setInfo(d.message || `Письмо отправлено на ${d.sent_to} для безвозвратного удаления.`);
      }
      setDeleteForId(null);
      setDeleteTyped("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function verify() {
    setError(null);
    setVerifying(true);
    setBot(null);
    setChannels([]);
    try {
      const r = await fetch("/api/max/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка проверки");
      setBot(d.bot);
      setChannels(d.channels);
      if (d.channels.length === 1) setSelected(d.channels[0].chat_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setVerifying(false);
    }
  }

  async function connect() {
    if (!bot || selected == null) return;
    const ch = channels.find((c) => c.chat_id === selected)!;
    setError(null);
    setConnecting(true);
    try {
      const r = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          max_bot_username: bot.username,
          max_bot_user_id: bot.user_id,
          channel_id: ch.chat_id,
          channel_link: ch.link,
          channel_title: ch.title,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось подключить");
      // подтянуть свежий список, спрятать форму, остаться на странице
      setShowAddForm(false);
      setToken(""); setBot(null); setChannels([]); setSelected(null);
      await loadConnected();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setConnecting(false);
    }
  }

  return (
    <Shell active="channels" title="Каналы" breadcrumbs={["Каналы"]}>
      <div style={{ padding: "24px 32px 40px", maxWidth: 760 }}>

        {/* ──────── список подключённых ──────── */}
        <div className="kk-card kk-pad-5" style={{ marginBottom: 18 }}>
          <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
            <div className="kk-h4">Подключённые боты</div>
            {connected.length > 0 && !showAddForm && (
              <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={() => setShowAddForm(true)}>
                <Icon name="plus" size={14} /> Подключить ещё
              </button>
            )}
          </div>

          {connected.length === 0 ? (
            <div className="kk-sm kk-muted" style={{ padding: "8px 0" }}>
              Пока ни одного бота. Добавь первого ниже — Maxiflow начнёт принимать подписчиков.
            </div>
          ) : (
            <div className="kk-col kk-gap-2">
              {connected.map((b) => {
                const expected = b.channel_title ?? b.max_bot_username;
                const isDeleteForm = deleteForId === b.id;
                return (
                  <div key={b.id} className="kk-col kk-gap-2" style={{
                    padding: 12, borderRadius: 10,
                    background: b.is_active ? "var(--n-25)" : "var(--n-50)",
                    opacity: b.is_active ? 1 : 0.85,
                  }}>
                    <div className="kk-row kk-gap-3">
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: "linear-gradient(135deg,#2E7DFF,#1EC8FF)",
                        color: "#fff", display: "grid", placeItems: "center", flexShrink: 0,
                      }}>
                        <Icon name="max" size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="kk-row kk-gap-2" style={{ alignItems: "center" }}>
                          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.channel_title ?? b.max_bot_username}
                          </div>
                          <span className="kk-chip" style={{ height: 20, fontSize: 11, background: "linear-gradient(135deg,#2E7DFF,#1EC8FF)", color: "#fff" }}>
                            MAX
                          </span>
                          {b.is_active ? (
                            <span className="kk-chip kk-chip-green" style={{ height: 20, fontSize: 11 }}>Активен</span>
                          ) : (
                            <span className="kk-chip" style={{ height: 20, fontSize: 11 }}>Отключён</span>
                          )}
                        </div>
                        <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>
                          @{b.max_bot_username}
                        </div>
                      </div>
                      <div className="kk-row kk-gap-1" style={{ flexShrink: 0 }}>
                        {b.is_active ? (
                          <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }}
                            onClick={() => disconnect(b)}
                            disabled={disconnecting === b.id}>
                            {disconnecting === b.id ? "…" : "Отключить"}
                          </button>
                        ) : (
                          <>
                            <button className="kk-btn kk-btn-outline kk-btn-sm"
                              onClick={() => reenable(b)} disabled={reenabling === b.id}>
                              {reenabling === b.id ? "…" : "Включить"}
                            </button>
                            <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }}
                              onClick={() => { setDeleteForId(isDeleteForm ? null : b.id); setDeleteTyped(""); }}>
                              {isDeleteForm ? "Отмена" : "Удалить навсегда"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {b.is_active && (
                      <PostUrlEditor bot={b} onSaved={loadConnected} />
                    )}

                    {isDeleteForm && (
                      <div className="kk-col kk-gap-2" style={{
                        padding: 12, borderRadius: 8, background: "var(--brand-coral-12)",
                        border: "1px solid #E5484D",
                      }}>
                        <div className="kk-sm" style={{ color: "#B12E1A", lineHeight: 1.5 }}>
                          ⚠️ Удалятся <b>все</b> лиды, диалоги, рассылки, воронки, лендинги и
                          источники этого бота. <b>Действие необратимо.</b>
                        </div>
                        <div className="kk-sm" style={{ lineHeight: 1.5 }}>
                          Для подтверждения введи название канала точно: <code style={{ fontWeight: 600 }}>{expected}</code>
                        </div>
                        <div className="kk-row kk-gap-2">
                          <input className="kk-input" style={{ flex: 1 }}
                            value={deleteTyped} onChange={(e) => setDeleteTyped(e.target.value)}
                            placeholder={expected} />
                          <button className="kk-btn kk-btn-accent"
                            style={{ background: "#E5484D", borderColor: "#E5484D" }}
                            disabled={deleteTyped.trim() !== expected}
                            onClick={() => confirmHardDelete(b)}>
                            Удалить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {info && (
            <div className="kk-sm" style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 8,
              background: "var(--brand-violet-12)", color: "var(--brand-violet-pressed)",
            }}>{info}</div>
          )}
        </div>

        {/* напоминание о реквизитах в описании бота для Яндекс.Директа */}
        {connected.length > 0 && (
          <div className="kk-card kk-pad-4" style={{ marginBottom: 18, background: "var(--brand-amber-12)", border: "1px solid #F0B400" }}>
            <div className="kk-row kk-gap-2" style={{ alignItems: "flex-start" }}>
              <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>⚠️</div>
              <div className="kk-sm" style={{ lineHeight: 1.55, color: "#7A4A00" }}>
                <b>Реклама ведёт прямо в бота? Добавь реквизиты в описание бота.</b>
                <br />
                Яндекс.Директ <b>не пропустит модерацию</b> без указания рекламодателя.
                В описании бота (в самом приложении MAX) должны быть:
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  <li>ИП или ООО (полное наименование)</li>
                  <li>контактный телефон</li>
                  <li>юридический адрес</li>
                  <li>ИНН</li>
                </ul>
                Если ведёшь рекламу через свой лендинг или мини-лендинг Maxiflow — реквизиты
                достаточно разместить на нём.
              </div>
            </div>
          </div>
        )}

        {/* ──────── форма добавления ──────── */}
        {(connected.length === 0 || showAddForm) && (
        <div className="kk-card kk-pad-6">
          <PlatformSwitch value={platformTab} onChange={setPlatformTab} />

          {platformTab === "telegram" ? (
            <TelegramConnect onConnected={() => { setShowAddForm(false); loadConnected(); }} />
          ) : (
          <>
          <div className="kk-row kk-gap-3" style={{ marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#2E7DFF,#1EC8FF)", color: "#fff", display: "grid", placeItems: "center" }}>
              <Icon name="max" size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em" }}>Подключите канал MAX</div>
              <div className="kk-sm kk-muted">Каскад будет видеть подписчиков, отвечать в чат-бот и слать рассылки</div>
            </div>
          </div>

          {/* шаги */}
          <div className="kk-col kk-gap-3">
            {STEPS.map((s) => (
              <div key={s.n} className="kk-row kk-gap-3" style={{ alignItems: "flex-start", padding: 14, borderRadius: 12, background: "var(--n-50)" }}>
                <div style={{ width: 26, height: 26, borderRadius: 99, background: "var(--n-0)", color: "var(--n-500)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0, boxShadow: "0 0 0 1px var(--n-200)" }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.t}</div>
                  <div className="kk-sm kk-muted" style={{ marginTop: 2 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* токен */}
          <div style={{ marginTop: 20 }}>
            <label className="kk-label">Токен бота MAX</label>
            <div className="kk-row kk-gap-2" style={{ marginTop: 6 }}>
              <input className="kk-input" style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13 }}
                value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="Вставьте токен от @MasterBot" />
              <button className="kk-btn kk-btn-accent" onClick={verify}
                disabled={verifying || !token.trim()} style={{ opacity: verifying || !token.trim() ? 0.6 : 1 }}>
                {verifying ? "Проверяю…" : "Проверить"}
              </button>
            </div>
          </div>

          {error && (
            <div className="kk-sm" style={{ marginTop: 12, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "10px 12px", borderRadius: 8 }}>
              {error}
            </div>
          )}

          {/* бот проверен */}
          {bot && (
            <div className="kk-row kk-gap-2 kk-sm" style={{ marginTop: 12, color: "var(--success)" }}>
              <Icon name="check" size={14} strokeWidth={2.4} />
              Бот найден: <b style={{ color: "var(--brand-ink)" }}>{bot.name}</b> · @{bot.username}
            </div>
          )}

          {/* каналы */}
          {bot && channels.length === 0 && (
            <div className="kk-sm kk-muted" style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "var(--brand-amber-12)", color: "#8A5A00" }}>
              Бот не админ ни в одном канале. Добавьте его администратором канала и нажмите «Проверить» ещё раз.
            </div>
          )}

          {channels.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label className="kk-label">Выберите канал</label>
              <div className="kk-col kk-gap-2" style={{ marginTop: 6 }}>
                {channels.map((c) => (
                  <button key={c.chat_id} onClick={() => setSelected(c.chat_id)}
                    className="kk-row kk-gap-3"
                    style={{
                      padding: 12, borderRadius: 10, cursor: "pointer", textAlign: "left",
                      border: "1.5px solid", borderColor: selected === c.chat_id ? "var(--brand-violet)" : "var(--n-200)",
                      background: selected === c.chat_id ? "var(--brand-violet-12)" : "var(--n-0)",
                    }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#5B47FB,#7C5CFF)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
                      {c.title?.[0] ?? "К"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
                      <div className="kk-xs kk-muted">
                        {c.participants_count != null ? `${c.participants_count} подписчиков` : "канал"}
                        {c.link ? ` · ${c.link}` : ""}
                      </div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: 99, border: "1.5px solid", borderColor: selected === c.chat_id ? "var(--brand-violet)" : "var(--n-300)", display: "grid", placeItems: "center" }}>
                      {selected === c.chat_id && <div style={{ width: 9, height: 9, borderRadius: 99, background: "var(--brand-violet)" }} />}
                    </div>
                  </button>
                ))}
              </div>

              <button className="kk-btn kk-btn-accent kk-btn-lg" onClick={connect}
                disabled={connecting || selected == null}
                style={{ width: "100%", marginTop: 16, opacity: connecting || selected == null ? 0.6 : 1 }}>
                {connecting ? "Подключаю…" : "Подключить канал"} <Icon name="arrow_r" size={14} />
              </button>
            </div>
          )}

          {connected.length > 0 && showAddForm && (
            <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ marginTop: 16 }}
              onClick={() => { setShowAddForm(false); setToken(""); setBot(null); setChannels([]); setSelected(null); setError(null); }}>
              ← Скрыть форму
            </button>
          )}
          </>
          )}
        </div>
        )}
      </div>
    </Shell>
  );
}

function TelegramConnect({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const r = await fetch("/api/telegram/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), channel: channel.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <>
      <div className="kk-row kk-gap-3" style={{ marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#229ED9,#27A9E1)", color: "#fff", display: "grid", placeItems: "center" }}>
          <Icon name="emoji" size={28} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em" }}>Подключите канал Telegram</div>
          <div className="kk-sm kk-muted">Бот через @BotFather и доступ админа в канале</div>
        </div>
      </div>

      <div className="kk-col kk-gap-3" style={{ marginBottom: 18 }}>
        <Step n={1} t="Создай бота в @BotFather" d="Команда /newbot → получи токен HTTP API." />
        <Step n={2} t="Добавь бота админом в канал" d="Дай права «Пригласить пользователей по ссылкам» и «Удалять сообщения»." />
        <Step n={3} t="Вставь токен и @канал" d="Maxiflow проверит и сохранит. Можно указать @username канала или числовой chat_id." />
      </div>

      <label className="kk-label">Токен бота Telegram</label>
      <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 13 }}
        value={token} onChange={(e) => setToken(e.target.value)}
        placeholder="123456:ABC-DEF..." />

      <label className="kk-label">@канал или chat_id</label>
      <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
        value={channel} onChange={(e) => setChannel(e.target.value)}
        placeholder="@my_channel или -1001234567890" />

      {error && (
        <div className="kk-sm" style={{ marginBottom: 12, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "10px 12px", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <button className="kk-btn kk-btn-accent kk-btn-lg"
        onClick={connect} disabled={connecting || !token.trim() || !channel.trim()}
        style={{ width: "100%", opacity: connecting ? 0.6 : 1 }}>
        {connecting ? "Подключаю…" : "Подключить Telegram"}
      </button>
    </>
  );
}

function Step({ n, t, d }: { n: number; t: string; d: string }) {
  return (
    <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start", padding: 14, borderRadius: 12, background: "var(--n-50)" }}>
      <div style={{ width: 26, height: 26, borderRadius: 99, background: "var(--n-0)", color: "var(--n-500)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0, boxShadow: "0 0 0 1px var(--n-200)" }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{t}</div>
        <div className="kk-sm kk-muted" style={{ marginTop: 2 }}>{d}</div>
      </div>
    </div>
  );
}

// ───────────────── Platform Switch ─────────────────
// Сегментированный контрол с брендовыми акцентами. Стиль — Apple / Linear.

function MaxLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
      <path d="M6 17V8l4 6 4-6v9M16 8v9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TelegramLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.5 4.4 18 19.6c-.3 1.1-1 1.4-2 .9l-5.5-4-2.6 2.6c-.3.3-.6.6-1.2.6l.4-5.6 10.3-9.3c.5-.4-.1-.6-.7-.3l-12.7 8L.5 11.6c-1.2-.4-1.2-1.2.3-1.8l19-7.3c1-.4 1.9.2 1.7 1.9z"/>
    </svg>
  );
}

function PostUrlEditor({ bot, onSaved }: { bot: ConnectedBot; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(bot.channel_post_url ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const trimmed = value.trim();
      const r = await fetch("/api/bots", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bot.id, channel_post_url: trimmed || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setOpen(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally { setSaving(false); }
  }

  const url = bot.channel_post_url?.trim() || null;

  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--n-0)", border: "1px solid var(--n-200)" }}>
      {open ? (
        <div className="kk-col kk-gap-2">
          <label className="kk-label" style={{ margin: 0 }}>URL поста в канале для рекламы</label>
          <input className="kk-input kk-btn-sm" style={{ width: "100%" }}
            value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="https://max.ru/<канал>/post/<id> или оставь пусто" autoFocus />
          <div className="kk-xs kk-muted" style={{ lineHeight: 1.5 }}>
            Если задано: реклама ведёт сначала на этот пост (юзер прочитает),
            затем кнопка под постом «Получить магнит» дотягивает его до бота с прокинутым yclid.
            Кнопку в посте ставь на <code>https://maxiflow.ru/g/{bot.max_bot_username}</code>.
          </div>
          {err && <div className="kk-xs" style={{ color: "var(--danger)" }}>{err}</div>}
          <div className="kk-row kk-gap-2">
            <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={save} disabled={saving}>
              {saving ? "..." : "Сохранить"}
            </button>
            <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => { setOpen(false); setValue(bot.channel_post_url ?? ""); setErr(null); }}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="kk-row kk-gap-2" style={{ alignItems: "center" }}>
          <Icon name="post" size={14} stroke="var(--n-500)" />
          <div className="kk-xs" style={{ flex: 1, minWidth: 0, color: url ? "var(--brand-ink)" : "var(--n-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {url ? <>Пост для рекламы: <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{url}</code></> : "Пост для рекламы не задан — реклама ведёт сразу в бота"}
          </div>
          <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => setOpen(true)}>
            {url ? "Изменить" : "Настроить"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlatformSwitch({ value, onChange }: {
  value: "max" | "telegram";
  onChange: (v: "max" | "telegram") => void;
}) {
  // Telegram временно скрыт из UI (мы поддерживаем платформу в БД, но продвигаем только MAX).
  // Существующие TG-боты продолжат работать; новые подключаем только MAX.
  const items: { id: "max" | "telegram"; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "max",      label: "MAX",      icon: <MaxLogo />,      color: "#2E7DFF" },
  ];
  return (
    <div style={{
      display: "inline-flex",
      gap: 2,
      padding: 4,
      borderRadius: 12,
      background: "var(--n-100)",
      marginBottom: 22,
      position: "relative",
    }}>
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 9,
              border: 0,
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: active ? 600 : 500,
              letterSpacing: "-0.01em",
              color: active ? it.color : "var(--n-500)",
              background: active ? "var(--n-0)" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" : "none",
              transition: "all .18s ease",
            }}>
            <span style={{ color: active ? it.color : "var(--n-400)", display: "flex" }}>
              {it.icon}
            </span>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
