"use client";
// Maxiflow — рассылки по подписчикам бота.
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/ui";
import { RichTextField } from "@/components/RichTextField";
import { MediaPicker, type MediaAsset } from "@/components/MediaPicker";

type MediaKind = "image" | "video" | "audio" | "video_note" | "file" | "sticker";
const MEDIA_KINDS: { value: MediaKind; label: string }[] = [
  { value: "image",      label: "Картинка" },
  { value: "video",      label: "Видео" },
  { value: "video_note", label: "Кружок" },
  { value: "audio",      label: "Голосовое" },
  { value: "file",       label: "Файл" },
  { value: "sticker",    label: "Стикер" },
];

type Bot = { id: string; max_bot_username: string; channel_title: string | null; platform?: "max" | "telegram" };
type Tag = { id: string; name: string; color: string };
type Broadcast = {
  id: string; text: string; total: number; sent: number; failed: number;
  clicks?: number | null;
  button?: { kind?: string; text?: string } | null;
  status: string; created_at: string; bots?: { channel_title: string | null } | null;
};
type Stats = {
  id: string; total: number; delivered: number; failed: number;
  clicks: number; replied: number; unsubscribed: number;
  retriable?: number;  // сколько из недоставленных ещё можно догнать
  dead?: number;       // сколько удалили диалог (dead-end)
};
type ButtonMode = "off" | "bot" | "url";

export default function BroadcastsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [audienceTag, setAudienceTag] = useState<string>("");
  const [text, setText] = useState("");
  const [list, setList] = useState<Broadcast[]>([]);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [btnMode, setBtnMode] = useState<ButtonMode>("off");
  const [btnText, setBtnText] = useState("Открыть");
  const [btnTargetBotId, setBtnTargetBotId] = useState("");
  const [btnStartCmd, setBtnStartCmd] = useState("");
  const [btnUrl, setBtnUrl] = useState("");

  const [mediaKind, setMediaKind] = useState<MediaKind>("image");
  const [mediaToken, setMediaToken] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [mediaThumb, setMediaThumb] = useState<string | null>(null);

  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ id: string; total: number; sent: number; failed: number; done: boolean } | null>(null);

  // предпросмотр аудитории — считаем после смены бота/тега
  useEffect(() => {
    if (!botId) { setAudienceCount(null); return; }
    const params = new URLSearchParams({ bot_id: botId });
    if (audienceTag) params.set("tag_id", audienceTag);
    fetch(`/api/broadcasts/preview?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAudienceCount(typeof d.count === "number" ? d.count : null))
      .catch(() => setAudienceCount(null));
  }, [botId, audienceTag]);

  // предупреждение о закрытии страницы во время отправки
  useEffect(() => {
    if (!progress || progress.done) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [progress]);

  const loadList = useCallback(async () => {
    const d = await fetch("/api/broadcasts", { cache: "no-store" }).then((r) => r.json());
    setList(d.broadcasts ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/bots").then((r) => r.json()).then(async (d) => {
      const list: Bot[] = d.bots ?? [];
      setBots(list);
      const { pickActiveBot } = await import("@/lib/active-bot");
      const pick = pickActiveBot(list);
      if (pick) { setBotId(pick.id); setBtnTargetBotId(pick.id); }
    });
    fetch("/api/tags").then((r) => r.json()).then((d) => setTags(d.tags ?? []));
    loadList();
  }, [loadList]);

  function buildButtonPayload(): Record<string, unknown> | undefined {
    if (btnMode === "off") return undefined;
    if (!btnText.trim()) return undefined;
    if (btnMode === "bot") {
      if (!btnTargetBotId) return undefined;
      return { kind: "bot", text: btnText.trim(), bot_id: btnTargetBotId, start_command: btnStartCmd.trim() || undefined };
    }
    if (!btnUrl.trim()) return undefined;
    return { kind: "url", text: btnText.trim(), url: btnUrl.trim() };
  }

  async function send() {
    setError(null);
    setResult(null);
    if (!botId) { setError("Сначала подключите бота"); return; }
    if (!text.trim()) { setError("Введите текст рассылки"); return; }
    if (audienceCount === 0) { setError("В аудитории 0 подписчиков"); return; }
    if (audienceCount != null && audienceCount > 50) {
      if (!confirm(`Отправить рассылку ${audienceCount} подписчикам?`)) return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId, text,
          tag_id: audienceTag || undefined,
          button: buildButtonPayload(),
          media_kind: mediaToken ? mediaKind : undefined,
          media_token: mediaToken ?? undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      if (!d.id) throw new Error("Не получил идентификатор рассылки");
      // отправка идёт в фоне — переходим в режим polling'а прогресса
      setProgress({ id: d.id, total: d.total ?? 0, sent: 0, failed: 0, done: false });
      pollProgress(d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setSending(false);
    }
  }

  async function pollProgress(id: string): Promise<void> {
    let stopped = false;
    while (!stopped) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const r = await fetch(`/api/broadcasts/${id}/progress`, { cache: "no-store" });
        if (!r.ok) throw new Error("polling error");
        const d = await r.json();
        setProgress({ id, total: d.total, sent: d.sent, failed: d.failed, done: !!d.done });
        if (d.done) {
          stopped = true;
          setResult(`Отправлено ${d.sent} из ${d.total}${d.failed ? `, не доставлено ${d.failed}` : ""}`);
          setSending(false);
          setText("");
          await loadList();
        }
      } catch {
        // сетевые сбои не критичны — продолжаем polling
      }
    }
  }

  async function sendTest() {
    setError(null);
    setResult(null);
    if (!botId) { setError("Сначала подключите бота"); return; }
    if (!text.trim()) { setError("Введите текст рассылки"); return; }
    setTesting(true);
    try {
      const r = await fetch("/api/broadcasts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId, text, button: buildButtonPayload(),
          media_kind: mediaToken ? mediaKind : undefined,
          media_token: mediaToken ?? undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setResult(d.sent > 0
        ? `Тест отправлен в ЛС ${d.sent === 1 ? "админа" : `${d.sent} админов`}. Проверьте личку бота.`
        : `Не удалось отправить: ${d.failed} ошибок из ${d.total}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setTesting(false);
    }
  }

  const buttonMissing =
    btnMode === "bot" ? (!btnText.trim() || !btnTargetBotId) :
    btnMode === "url" ? (!btnText.trim() || !btnUrl.trim()) :
    false;

  return (
    <Shell active="broadcasts" title="Рассылки" breadcrumbs={["Автоматизация", "Рассылки"]}>
      <div style={{ padding: "20px 24px", maxWidth: 760 }}>

        <div className="kk-card kk-pad-5" style={{ marginBottom: 16 }}>
          <SectionTitle sub="сообщение уйдёт всем подписчикам, у кого есть диалог с ботом">
            Новая рассылка
          </SectionTitle>
          <label className="kk-label">Бот</label>
          <select className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
            value={botId} onChange={(e) => { setBotId(e.target.value); import("@/lib/active-bot").then((m) => m.writeActiveBotId(e.target.value)); }}>
            {bots.length === 0 && <option value="">— нет подключённых ботов —</option>}
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>
            ))}
          </select>

          <label className="kk-label">Аудитория</label>
          <select className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
            value={audienceTag} onChange={(e) => setAudienceTag(e.target.value)}>
            <option value="">Все подписчики бота</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>Только с тегом «{t.name}»</option>
            ))}
          </select>

          <label className="kk-label">Текст</label>
          <div style={{ marginTop: 4 }}>
            <RichTextField value={text} onChange={setText} rows={5} placeholder="Текст рассылки…" />
          </div>
          <div className="kk-xs kk-muted" style={{ marginTop: 6 }}>
            Поддерживается форматирование: **жирный**, _курсив_, ссылки. До 4000 символов.
          </div>

          <div style={{ marginTop: 14 }}>
            <BroadcastMediaBlock botId={botId}
              kind={mediaKind} setKind={setMediaKind}
              token={mediaToken} name={mediaName} thumb={mediaThumb}
              onPick={(a: MediaAsset) => {
                setMediaKind(a.kind as MediaKind);
                setMediaToken(a.token);
                setMediaName(a.name ?? null);
                setMediaThumb(a.thumbnail_url ?? null);
              }}
              onClear={() => { setMediaToken(null); setMediaName(null); setMediaThumb(null); }}
            />
          </div>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--n-25)" }}>
            <div className="kk-row kk-gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <span className="kk-sm" style={{ fontWeight: 600 }}>Кнопка под сообщением:</span>
              {(["off", "bot", "url"] as ButtonMode[]).map((m) => (
                <button key={m} className="kk-btn kk-btn-sm"
                  onClick={() => setBtnMode(m)}
                  style={{
                    background: btnMode === m ? "var(--brand-violet-12)" : "var(--n-0)",
                    border: btnMode === m ? "1.5px solid var(--brand-violet)" : "1px solid var(--n-200)",
                    color: btnMode === m ? "var(--brand-violet)" : "var(--n-700)",
                    fontWeight: btnMode === m ? 600 : 500,
                  }}>
                  {m === "off" ? "без кнопки" : m === "bot" ? "в бота" : "по ссылке"}
                </button>
              ))}
            </div>

            {btnMode !== "off" && (
              <div className="kk-col kk-gap-2" style={{ marginTop: 10 }}>
                <input className="kk-input kk-btn-sm"
                  placeholder="Текст на кнопке"
                  value={btnText}
                  onChange={(e) => setBtnText(e.target.value)} />

                {btnMode === "bot" && (
                  <>
                    <select className="kk-input kk-btn-sm"
                      value={btnTargetBotId} onChange={(e) => setBtnTargetBotId(e.target.value)}>
                      {bots.map((b) => (
                        <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>
                      ))}
                    </select>
                    <input className="kk-input kk-btn-sm"
                      placeholder="Стартовая команда (опционально, например trig_promo)"
                      value={btnStartCmd}
                      onChange={(e) => setBtnStartCmd(e.target.value)}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} />
                    <div className="kk-xs kk-muted">
                      Кнопка откроет выбранного бота и передаст команду в /start. Если оставить пусто — просто откроет бот.
                    </div>
                  </>
                )}

                {btnMode === "url" && (
                  <input className="kk-input kk-btn-sm" type="url"
                    placeholder="https://..."
                    value={btnUrl}
                    onChange={(e) => setBtnUrl(e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} />
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="kk-sm" style={{ marginTop: 12, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
              {error}
            </div>
          )}
          {result && (
            <div className="kk-row kk-gap-2 kk-sm" style={{ marginTop: 12, color: "#0A7A3C", background: "var(--success-12)", padding: "8px 12px", borderRadius: 8 }}>
              <Icon name="check" size={14} strokeWidth={2.4} /> {result}
            </div>
          )}

          <div className="kk-row kk-gap-2" style={{ marginTop: 14 }}>
            <button className="kk-btn kk-btn-outline kk-btn-lg" onClick={sendTest} disabled={testing || sending || buttonMissing}
              style={{ opacity: (testing || sending || buttonMissing) ? 0.6 : 1 }}
              title={buttonMissing ? "Заполните поля кнопки или выключите её" : "Отправить только в личку бота (для проверки)"}>
              {testing ? "Отправляю…" : "Тестовая (в свой ЛС)"} <Icon name="eye" size={14} />
            </button>
            <button className="kk-btn kk-btn-accent kk-btn-lg" onClick={send} disabled={sending || testing || buttonMissing || audienceCount === 0}
              style={{ flex: 1, opacity: (sending || testing || buttonMissing || audienceCount === 0) ? 0.6 : 1 }}>
              {sending ? "Отправляю…" :
                audienceCount == null ? "Отправить всем" :
                audienceCount === 0 ? "Нет подписчиков в аудитории" :
                `Отправить всем (${audienceCount})`} <Icon name="broadcast" size={14} />
            </button>
          </div>
          {buttonMissing && (
            <div className="kk-xs kk-muted" style={{ marginTop: 6 }}>
              Заполните поля кнопки (текст + {btnMode === "bot" ? "выбранный бот" : "URL"}) или выключите кнопку.
            </div>
          )}
        </div>

        <SectionTitle sub="последние рассылки">История</SectionTitle>
        {list.length === 0 ? (
          <div className="kk-card kk-pad-5 kk-muted kk-sm" style={{ textAlign: "center" }}>
            Рассылок пока не было.
          </div>
        ) : (
          <div className="kk-col kk-gap-2">
            {list.map((b) => (
              <BroadcastRow key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>
      {progress && <ProgressModal p={progress} onClose={() => setProgress(null)} />}
    </Shell>
  );
}

function ProgressModal({ p, onClose }: {
  p: { id: string; total: number; sent: number; failed: number; done: boolean };
  onClose: () => void;
}) {
  const processed = p.sent + p.failed;
  const pct = p.total > 0 ? Math.min(100, Math.round((processed / p.total) * 100)) : 0;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(20,20,28,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      padding: 20,
    }}>
      <div className="kk-card" style={{ maxWidth: 460, width: "100%", padding: 24, borderRadius: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {p.done ? "Рассылка завершена" : "Отправка идёт…"}
        </div>
        <div className="kk-sm kk-muted" style={{ marginBottom: 16 }}>
          {p.done
            ? `Отправлено ${p.sent} из ${p.total}${p.failed ? `, не доставлено ${p.failed}` : ""}.`
            : "Не закрывайте эту страницу — прогресс сохраняется автоматически."}
        </div>

        <div style={{
          height: 10, background: "var(--n-100)", borderRadius: 999, overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: p.done ? "var(--success)" : "var(--brand-violet)",
            transition: "width 0.4s ease",
          }} />
        </div>
        <div className="kk-row kk-gap-3" style={{ marginTop: 10, justifyContent: "space-between", fontSize: 13.5 }}>
          <span>
            <b style={{ fontSize: 20, letterSpacing: "-0.02em" }}>{processed}</b>
            <span className="kk-muted"> / {p.total}</span>
          </span>
          <span>
            <span style={{ color: "#0A7A3C" }}>✓ {p.sent}</span>
            {p.failed > 0 && <span style={{ color: "var(--danger)", marginLeft: 12 }}>✗ {p.failed}</span>}
          </span>
          <span style={{ color: "var(--brand-violet)", fontWeight: 700 }}>{pct}%</span>
        </div>

        {p.done && (
          <button className="kk-btn kk-btn-accent kk-btn-lg"
            style={{ width: "100%", marginTop: 20 }} onClick={onClose}>
            Закрыть
          </button>
        )}
      </div>
    </div>
  );
}

function BroadcastRow({ b }: { b: Broadcast }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function resend() {
    if (resending) return;
    if (!stats) return;
    const undelivered = (stats.total ?? 0) - (stats.delivered ?? 0);
    if (undelivered <= 0) return;
    if (!confirm(`Дослать сообщение ${undelivered} юзерам, которым не долетело?`)) return;
    setResending(true);
    setResendMsg("Отправляю…");
    try {
      const r = await fetch(`/api/broadcasts/${b.id}/resend`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setResendMsg(`Досылаю ${d.retry_count} юзерам… обновите через минуту.`);
      setTimeout(async () => {
        const s = await fetch(`/api/broadcasts/${b.id}/stats`, { cache: "no-store" }).then((r) => r.json());
        setStats(s);
        setResendMsg(null);
      }, 8000);
    } catch (e) {
      setResendMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setResending(false);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !stats && !loading) {
      setLoading(true);
      try {
        const r = await fetch(`/api/broadcasts/${b.id}/stats`, { cache: "no-store" });
        const d = await r.json();
        if (r.ok) setStats(d);
      } finally {
        setLoading(false);
      }
    }
  }

  const dateStr = (b.created_at || "").slice(0, 16).replace("T", " ");
  const btnLabel = b.button?.text ? `с кнопкой «${b.button.text}»` : null;
  const percent = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="kk-card kk-pad-4">
      <div className="kk-row kk-gap-3" style={{ alignItems: "center", cursor: "pointer" }} onClick={toggle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.text}
          </div>
          <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>
            {dateStr} · {b.bots?.channel_title ?? ""}{btnLabel ? ` · ${btnLabel}` : ""}
          </div>
        </div>
        <span className="kk-chip kk-chip-green" style={{ height: 22 }}>
          {b.sent} / {b.total}
        </span>
        <Icon name={open ? "chevron_d" : "chevron_r"} size={14} stroke="var(--n-500)" strokeWidth={2} />
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--n-100)" }}>
          {loading || !stats ? (
            <div className="kk-sm kk-muted">Считаю статистику…</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <StatCell label="Всего" value={stats.total} sub="в аудитории" />
                <StatCell label="Доставлено" value={stats.delivered} sub={`${percent(stats.delivered, stats.total)}%`} accent="ok" />
                {btnLabel && (
                  <StatCell label="Кликов" value={stats.clicks} sub={`${percent(stats.clicks, stats.delivered)}% CTR`} accent={stats.clicks > 0 ? "ok" : undefined} />
                )}
              </div>
              {(stats.retriable ?? 0) > 0 && (
                <div className="kk-row kk-gap-2" style={{ marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="kk-btn kk-btn-outline kk-btn-sm" onClick={resend} disabled={resending}
                    style={{ opacity: resending ? 0.6 : 1 }}>
                    <Icon name="broadcast" size={12} strokeWidth={2} />
                    {resending ? "Досылаю…" : `Дослать (${stats.retriable})`}
                  </button>
                  {resendMsg && (
                    <span className="kk-xs" style={{ color: "var(--n-600)" }}>{resendMsg}</span>
                  )}
                </div>
              )}
              {(stats.dead ?? 0) > 0 && (
                <div className="kk-xs kk-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  {stats.dead} юзерам не долетело — они удалили диалог с ботом. Достучаться нельзя,
                  из следующих рассылок исключены автоматически.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: "ok" | "warn" }) {
  const color = accent === "ok" ? "#0A7A3C" : accent === "warn" ? "#8A5A00" : "var(--n-700)";
  const bg = accent === "ok" ? "var(--success-12)" : accent === "warn" ? "var(--brand-amber-12)" : "var(--n-50)";
  return (
    <div style={{ background: bg, padding: "10px 12px", borderRadius: 10 }}>
      <div className="kk-xs kk-muted" style={{ textTransform: "uppercase", letterSpacing: 0.04, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="kk-xs" style={{ color: "var(--n-500)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BroadcastMediaBlock({
  botId, kind, setKind, token, name, thumb, onPick, onClear,
}: {
  botId: string;
  kind: MediaKind;
  setKind: (k: MediaKind) => void;
  token: string | null;
  name: string | null;
  thumb: string | null;
  onPick: (a: MediaAsset) => void;
  onClear: () => void;
}) {
  if (!botId) return null;
  return (
    <div>
      <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label className="kk-label" style={{ margin: 0 }}>Прикрепить фото / видео / файл</label>
        {token && (
          <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }} onClick={onClear}>
            Убрать
          </button>
        )}
      </div>
      {token ? (
        <div className="kk-card kk-pad-3 kk-row kk-gap-2" style={{ background: "var(--n-0)" }}>
          {thumb ? (
            <img src={thumb} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--n-100)" }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kk-sm" style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name ?? `${kind} ${token.slice(0, 6)}`}
            </div>
            <div className="kk-xs kk-muted">{kind}</div>
          </div>
        </div>
      ) : (
        <>
          <select className="kk-input kk-btn-sm" style={{ width: "100%", marginBottom: 6 }}
            value={kind} onChange={(e) => setKind(e.target.value as MediaKind)}>
            {MEDIA_KINDS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <MediaPicker botId={botId} kind={kind} selectedToken={undefined} onPick={onPick} />
        </>
      )}
    </div>
  );
}
