"use client";
// Maxiflow — посты канала: список существующих постов, правка текста c
// форматированием/эмодзи, публикация новых постов и отложенный постинг.
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

type Bot = { id: string; max_bot_username: string; channel_title: string | null };
type Post = {
  mid: string; text: string; views: number | null; url: string | null;
  hasButton: boolean;
  buttonText: string | null;
  buttonUrl: string | null;
  subscribeMessage: string | null;
  disableLinkPreview: boolean;
  mediaKind: MediaKind | null;
  mediaThumb: string | null;
};
type Scheduled = {
  id: string; bot_id: string; text: string; button_text: string | null;
  scheduled_at: string; status: string; error: string | null;
};
type Funnel = { id: string; name: string; trigger_command: string | null; is_default: boolean };

const DEFAULT_SUBSCRIBE_MSG =
  "🔒 Материал доступен только подписчикам канала.\n\nЧтобы получить:\n\n1. Подпишись на канал\n2. Нажми «Я подписался — проверить»";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function PostsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [nFunnelId, setNFunnelId] = useState("");
  const [eFunnelId, setEFunnelId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformUnsupported, setPlatformUnsupported] = useState<string | null>(null);
  // true пока не проверено — чтобы не мигал ложный warning на первом рендере
  const [channelAdmin, setChannelAdmin] = useState<boolean>(true);

  // редактирование существующего поста
  const [editMid, setEditMid] = useState<string | null>(null);
  const [eText, setEText] = useState("");
  const [eBtn, setEBtn] = useState(true);
  const [eBtnText, setEBtnText] = useState("Получить материал");
  // куда ведёт кнопка: воронка (funnel) или произвольная ссылка (url)
  const [eBtnMode, setEBtnMode] = useState<"funnel" | "url">("funnel");
  const [eBtnUrl, setEBtnUrl] = useState("");
  // проверять подписку через мини-апп (?startapp=pc_...); OFF — прямая ссылка в бота (?start=trigger)
  const [eUseMiniapp, setEUseMiniapp] = useState(true);
  const [eSubscribeMsg, setESubscribeMsg] = useState("");
  const [eMediaKind, setEMediaKind] = useState<MediaKind>("image");
  const [eMediaToken, setEMediaToken] = useState<string | null>(null);
  const [eMediaName, setEMediaName] = useState<string | null>(null);
  const [eMediaThumb, setEMediaThumb] = useState<string | null>(null);
  const [eDisableLinkPreview, setEDisableLinkPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // новый пост
  const [showNew, setShowNew] = useState(false);
  const [nText, setNText] = useState("");
  const [nBtn, setNBtn] = useState(true);
  const [nBtnText, setNBtnText] = useState("Получить материал");
  const [nBtnMode, setNBtnMode] = useState<"funnel" | "url">("funnel");
  const [nBtnUrl, setNBtnUrl] = useState("");
  const [nUseMiniapp, setNUseMiniapp] = useState(true);
  const [nSubscribeMsg, setNSubscribeMsg] = useState("");
  const [nMediaKind, setNMediaKind] = useState<MediaKind>("image");
  const [nMediaToken, setNMediaToken] = useState<string | null>(null);
  const [nMediaName, setNMediaName] = useState<string | null>(null);
  const [nMediaThumb, setNMediaThumb] = useState<string | null>(null);
  const [nDisableLinkPreview, setNDisableLinkPreview] = useState(false);
  const [nSchedule, setNSchedule] = useState(false);
  const [nWhen, setNWhen] = useState("");
  const [publishing, setPublishing] = useState(false);
  // превью — какая форма открыта в модалке: "new" | "edit" | null
  const [previewMode, setPreviewMode] = useState<"new" | "edit" | null>(null);

  useEffect(() => {
    fetch("/api/bots").then((r) => r.json()).then(async (d) => {
      const list = d.bots ?? [];
      setBots(list);
      const { pickActiveBot } = await import("@/lib/active-bot");
      const pick = pickActiveBot(list);
      if (pick) setBotId(pick.id);
    });
  }, []);

  const loadPosts = useCallback(async (bid: string) => {
    if (!bid) return;
    setLoading(true);
    setError(null);
    setPlatformUnsupported(null);
    try {
      const r = await fetch(`/api/channel-posts?bot_id=${bid}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setPosts(d.posts ?? []);
      if (d.unsupported_reason) setPlatformUnsupported(d.unsupported_reason);
      // channel_admin приходит только для MAX; для Telegram — undefined, банер не показываем
      setChannelAdmin(d.platform === "max" ? Boolean(d.channel_admin) : true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScheduled = useCallback(async () => {
    try {
      const r = await fetch("/api/scheduled-posts");
      const d = await r.json();
      if (r.ok) setScheduled(d.posts ?? []);
    } catch {
      /* не критично */
    }
  }, []);

  useEffect(() => { if (botId) loadPosts(botId); }, [botId, loadPosts]);
  useEffect(() => { loadScheduled(); }, [loadScheduled]);

  // воронки бота — для выбора, какую запускает кнопка магнита
  useEffect(() => {
    if (!botId) { setFunnels([]); setNFunnelId(""); setEFunnelId(""); return; }
    fetch(`/api/funnel?bot_id=${botId}`).then((r) => r.json()).then((d) => {
      const list: Funnel[] = d.funnels ?? [];
      setFunnels(list);
      const def = list.find((f) => f.is_default) ?? list[0];
      if (def) { setNFunnelId(def.id); setEFunnelId(def.id); }
      else { setNFunnelId(""); setEFunnelId(""); }
    }).catch(() => { /* не критично */ });
  }, [botId]);

  // если у бота нет воронок — режим "воронка" недоступен; переключаем формы на url,
  // чтобы юзер физически не мог отправить пустой funnel_id.
  useEffect(() => {
    if (funnels.length === 0) {
      if (nBtnMode === "funnel") setNBtnMode("url");
      if (eBtnMode === "funnel") setEBtnMode("url");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnels.length]);

  // Как только пользователь включает "Кнопка лид-магнита" — подставляем базовый
  // текст «подпишись на канал», если поле ещё пустое. Так не надо вводить руками.
  useEffect(() => {
    if (nBtn && !nSubscribeMsg) setNSubscribeMsg(DEFAULT_SUBSCRIBE_MSG);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nBtn]);
  useEffect(() => {
    if (eBtn && !eSubscribeMsg) setESubscribeMsg(DEFAULT_SUBSCRIBE_MSG);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eBtn]);

  function startEdit(p: Post) {
    setEditMid(p.mid);
    setEText(p.text);
    setEBtn(p.hasButton);
    // Прокидываем сохранённые значения — чтобы юзер не вписывал заново.
    setEBtnText(p.buttonText?.trim() || "Получить материал");
    // Если у кнопки в текущем URL не наш deeplink/Mini App — значит произвольная ссылка.
    const url = p.buttonUrl ?? "";
    const isCustomUrl = !!url && !/^https?:\/\/max\.ru\//.test(url) && !/maxiflow\.ru\/(r|m|g)\//.test(url);
    setEBtnMode(isCustomUrl ? "url" : "funnel");
    setEBtnUrl(isCustomUrl ? url : "");
    // Определяем режим проверки подписки: `?startapp=pc_...` → мини-апп, `?start=...` → прямая ссылка.
    // Если у сохранённого поста есть subscribeMessage — точно мини-апп.
    const looksLikeMiniapp = /startapp=pc_/.test(url) || !!p.subscribeMessage;
    setEUseMiniapp(looksLikeMiniapp);
    setESubscribeMsg(p.subscribeMessage ?? "");
    setEDisableLinkPreview(p.disableLinkPreview);
    // существующее медиа поста из API не приходит — открываем без выбранного.
    // Если юзер добавит медиа на редактировании — MAX заменит вложение.
    setEMediaToken(null);
    setEMediaName(null);
    setEMediaThumb(null);
    setError(null);
  }

  async function saveEdit() {
    if (!editMid) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/channel-posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId, mid: editMid, text: eText,
          with_button: eBtn, button_text: eBtnText,
          funnel_id: eBtn && eBtnMode === "funnel" ? eFunnelId : undefined,
          button_url: eBtn && eBtnMode === "url" ? eBtnUrl : undefined,
          use_miniapp: eBtn && eBtnMode === "funnel" ? eUseMiniapp : undefined,
          subscribe_message: eBtn && eBtnMode === "funnel" && eUseMiniapp && eSubscribeMsg.trim() ? eSubscribeMsg.trim() : undefined,
          media_kind: eMediaToken ? eMediaKind : undefined,
          media_token: eMediaToken ?? undefined,
          disable_link_preview: eDisableLinkPreview || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setEditMid(null);
      await loadPosts(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  function openNew() {
    setShowNew((v) => {
      const next = !v;
      if (next && !nWhen) setNWhen(toLocalInput(new Date(Date.now() + 3600_000)));
      return next;
    });
  }

  async function publishNew() {
    if (!nText.trim()) { setError("Введите текст поста"); return; }
    let scheduledAt: string | undefined;
    if (nSchedule) {
      if (!nWhen) { setError("Укажите дату и время публикации"); return; }
      const when = new Date(nWhen);
      if (isNaN(when.getTime()) || when.getTime() < Date.now() + 30_000) {
        setError("Время публикации должно быть в будущем"); return;
      }
      scheduledAt = when.toISOString();
    }
    setPublishing(true);
    setError(null);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId, text: nText,
          button_text: nBtn ? nBtnText : "",
          funnel_id: nBtn && nBtnMode === "funnel" ? nFunnelId : undefined,
          button_url: nBtn && nBtnMode === "url" ? nBtnUrl : undefined,
          use_miniapp: nBtn && nBtnMode === "funnel" ? nUseMiniapp : undefined,
          subscribe_message: nBtn && nBtnMode === "funnel" && nUseMiniapp && nSubscribeMsg.trim() ? nSubscribeMsg.trim() : undefined,
          scheduled_at: scheduledAt,
          media_kind: nMediaToken ? nMediaKind : undefined,
          media_token: nMediaToken ?? undefined,
          disable_link_preview: nDisableLinkPreview || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setNText("");
      setShowNew(false);
      setNSchedule(false);
      setNMediaToken(null); setNMediaName(null); setNMediaThumb(null);
      setNSubscribeMsg("");
      if (d.scheduled) await loadScheduled();
      else await loadPosts(botId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setPublishing(false);
    }
  }

  async function cancelScheduled(id: string) {
    const r = await fetch(`/api/scheduled-posts?id=${id}`, { method: "DELETE" });
    if (r.ok) setScheduled((s) => s.filter((p) => p.id !== id));
  }

  return (
    <Shell active="posts" title="Посты канала" breadcrumbs={["Контент", "Посты"]}
      rightSlot={
        <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={openNew}>
          <Icon name="plus" size={13} /> Новый пост
        </button>
      }>
      <div style={{ padding: "20px 24px", maxWidth: 880 }}>

        <div className="kk-row kk-gap-2" style={{ marginBottom: 16 }}>
          <select className="kk-input" style={{ width: 280, maxWidth: "100%" }}
            value={botId} onChange={(e) => { setBotId(e.target.value); import("@/lib/active-bot").then((m) => m.writeActiveBotId(e.target.value)); }}>
            {bots.length === 0 && <option value="">— нет подключённых ботов —</option>}
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>
            ))}
          </select>
          <button className="kk-btn kk-btn-outline kk-btn-sm" onClick={() => loadPosts(botId)}>
            Обновить
          </button>
        </div>

        {error && (
          <div className="kk-sm" style={{ marginBottom: 12, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
            {error}
          </div>
        )}

        {botId && !channelAdmin && (
          <div style={{
            marginBottom: 12, padding: "12px 14px", borderRadius: 10,
            background: "var(--brand-amber-12)", border: "1px solid var(--brand-amber)",
            color: "#7a4a00", fontSize: 14, lineHeight: 1.55,
          }}>
            <b>Бот не является администратором в канале.</b> Публикация и правка постов не сработают, пока вы не назначите бота админом.
            <br />
            <span className="kk-sm">
              В настройках канала откройте список администраторов и добавьте туда вашего бота (@{bots.find((b) => b.id === botId)?.max_bot_username ?? ""}).
              После этого нажмите «Обновить».
            </span>
          </div>
        )}

        {/* новый пост */}
        {showNew && (
          <div className="kk-card kk-pad-5" style={{ marginBottom: 16 }}>
            <SectionTitle>Новый пост</SectionTitle>
            <div style={{ marginTop: 4 }}>
              <RichTextField value={nText} onChange={setNText} rows={5} placeholder="Текст поста…" />
            </div>
            <div className="kk-xs kk-muted" style={{ marginTop: 6 }}>
              Поддерживается форматирование: **жирный**, _курсив_, ссылки. До 4000 символов.
            </div>

            <div className="kk-row kk-gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
              <Toggle on={nBtn} onChange={setNBtn} />
              <span className="kk-sm">Кнопка лид-магнита</span>
              {nBtn && (
                <input className="kk-input kk-btn-sm" style={{ flex: 1, minWidth: 160, maxWidth: 240 }}
                  value={nBtnText} onChange={(e) => setNBtnText(e.target.value)} />
              )}
            </div>

            {nBtn && (
              <div className="kk-col kk-gap-2" style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--n-25)" }}>
                <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                  <span className="kk-sm">Куда ведёт кнопка:</span>
                  <button className="kk-btn kk-btn-sm"
                    disabled={funnels.length === 0}
                    title={funnels.length === 0 ? "У бота ещё нет ни одной воронки" : undefined}
                    onClick={() => setNBtnMode("funnel")}
                    style={{
                      background: nBtnMode === "funnel" ? "var(--brand-violet-12)" : "var(--n-0)",
                      border: nBtnMode === "funnel" ? "1.5px solid var(--brand-violet)" : "1px solid var(--n-200)",
                      color: nBtnMode === "funnel" ? "var(--brand-violet)" : "var(--n-700)",
                      fontWeight: nBtnMode === "funnel" ? 600 : 500,
                      opacity: funnels.length === 0 ? 0.5 : 1,
                      cursor: funnels.length === 0 ? "not-allowed" : "pointer",
                    }}>
                    в бота (воронка){funnels.length === 0 ? " — нет воронок" : ""}
                  </button>
                  <button className="kk-btn kk-btn-sm"
                    onClick={() => setNBtnMode("url")}
                    style={{
                      background: nBtnMode === "url" ? "var(--brand-violet-12)" : "var(--n-0)",
                      border: nBtnMode === "url" ? "1.5px solid var(--brand-violet)" : "1px solid var(--n-200)",
                      color: nBtnMode === "url" ? "var(--brand-violet)" : "var(--n-700)",
                      fontWeight: nBtnMode === "url" ? 600 : 500,
                    }}>
                    произвольная ссылка
                  </button>
                </div>

                {nBtnMode === "funnel" && funnels.length > 0 && (
                  <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                    <span className="kk-sm kk-muted">Воронка:</span>
                    <select className="kk-input kk-btn-sm" style={{ minWidth: 200 }}
                      value={nFunnelId} onChange={(e) => setNFunnelId(e.target.value)}>
                      {funnels.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}{f.is_default ? " (по умолчанию)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {nBtnMode === "url" && (
                  <input className="kk-input kk-btn-sm" type="url"
                    placeholder="https://..."
                    value={nBtnUrl}
                    onChange={(e) => setNBtnUrl(e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} />
                )}

                {nBtnMode === "funnel" && (
                  <MiniappToggle
                    on={nUseMiniapp}
                    onChange={setNUseMiniapp}
                    subscribeMsg={nSubscribeMsg}
                    setSubscribeMsg={setNSubscribeMsg}
                  />
                )}
              </div>
            )}

            <div className="kk-row kk-gap-2" style={{ marginTop: 10, alignItems: "center" }}>
              <input type="checkbox" id="n-disable-link"
                checked={nDisableLinkPreview}
                onChange={(e) => setNDisableLinkPreview(e.target.checked)} />
              <label htmlFor="n-disable-link" className="kk-sm" style={{ cursor: "pointer" }}>
                Не показывать превью ссылок (огромный значок при ссылке в тексте)
              </label>
            </div>

            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--n-25)" }}>
              <PostMediaBlock botId={botId}
                kind={nMediaKind} setKind={setNMediaKind}
                token={nMediaToken} name={nMediaName} thumb={nMediaThumb}
                onPick={(a) => { setNMediaToken(a.token); setNMediaName(a.name); setNMediaThumb(a.thumbnail_url); }}
                onClear={() => { setNMediaToken(null); setNMediaName(null); setNMediaThumb(null); }} />
            </div>

            <div className="kk-row kk-gap-2" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <Toggle on={nSchedule} onChange={setNSchedule} />
              <span className="kk-sm">Отложить публикацию</span>
              {nSchedule && (
                <input type="datetime-local" className="kk-input kk-btn-sm"
                  style={{ minWidth: 200 }}
                  min={toLocalInput(new Date())}
                  value={nWhen} onChange={(e) => setNWhen(e.target.value)} />
              )}
            </div>

            <div className="kk-row kk-gap-2" style={{ marginTop: 14 }}>
              <button className="kk-btn kk-btn-outline" onClick={() => setPreviewMode("new")} disabled={publishing}>
                <Icon name="eye" size={14} /> Превью
              </button>
              <button className="kk-btn kk-btn-accent" onClick={publishNew} disabled={publishing}
                style={{ opacity: publishing ? 0.6 : 1 }}>
                {publishing
                  ? (nSchedule ? "Планирую…" : "Публикую…")
                  : (nSchedule ? "Запланировать" : "Опубликовать сейчас")}
              </button>
            </div>
          </div>
        )}

        {/* запланированные посты */}
        {scheduled.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>Запланированные ({scheduled.length})</SectionTitle>
            <div className="kk-col kk-gap-2" style={{ marginTop: 8 }}>
              {scheduled.map((p) => (
                <div key={p.id} className="kk-card kk-pad-4">
                  <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>
                        {p.text}
                      </div>
                      <div className="kk-row kk-gap-3" style={{ marginTop: 6, flexWrap: "wrap" }}>
                        {p.status === "failed" ? (
                          <span className="kk-chip kk-chip-coral" style={{ height: 20, fontSize: 11 }}>
                            ошибка: {p.error || "не отправлен"}
                          </span>
                        ) : p.status === "sending" ? (
                          <span className="kk-chip kk-chip-amber" style={{ height: 20, fontSize: 11 }}>
                            публикуется…
                          </span>
                        ) : (
                          <span className="kk-chip kk-chip-violet" style={{ height: 20, fontSize: 11 }}>
                            <Icon name="calendar" size={11} /> {fmtWhen(p.scheduled_at)}
                          </span>
                        )}
                        {p.button_text && (
                          <span className="kk-xs kk-muted">кнопка: {p.button_text}</span>
                        )}
                      </div>
                    </div>
                    {p.status === "pending" && (
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => cancelScheduled(p.id)}>
                        <Icon name="trash" size={12} /> Отменить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* список постов канала */}
        {loading ? (
          <div className="kk-muted kk-sm" style={{ padding: 40, textAlign: "center" }}>Загрузка постов…</div>
        ) : platformUnsupported ? (
          <div className="kk-card kk-pad-6" style={{ background: "var(--brand-amber-12)" }}>
            <div className="kk-row kk-gap-2" style={{ marginBottom: 8 }}>
              <Icon name="bell" size={16} stroke="#8A5A00" />
              <div style={{ fontWeight: 600, fontSize: 14, color: "#8A5A00" }}>
                История постов недоступна
              </div>
            </div>
            <div className="kk-sm" style={{ lineHeight: 1.55 }}>
              {platformUnsupported} Можно публиковать новые посты через форму выше — они уйдут в канал прямо сейчас или по расписанию.
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="kk-card kk-pad-6" style={{ textAlign: "center", color: "var(--n-500)" }}>
            В канале пока нет постов.
          </div>
        ) : (
          <div className="kk-col kk-gap-3">
            {posts.map((p) => (
              <div key={p.mid} className="kk-card kk-pad-5">
                {editMid === p.mid ? (
                  <div>
                    <label className="kk-label">Текст поста</label>
                    <div style={{ marginTop: 4 }}>
                      <RichTextField value={eText} onChange={setEText} rows={6} />
                    </div>
                    <div className="kk-row kk-gap-2" style={{ marginTop: 10, flexWrap: "wrap" }}>
                      <Toggle on={eBtn} onChange={setEBtn} />
                      <span className="kk-sm">Кнопка лид-магнита под постом</span>
                      {eBtn && (
                        <input className="kk-input kk-btn-sm" style={{ flex: 1, minWidth: 160, maxWidth: 240 }}
                          value={eBtnText} onChange={(e) => setEBtnText(e.target.value)} />
                      )}
                    </div>
                    {eBtn && (
                      <div className="kk-col kk-gap-2" style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--n-25)" }}>
                        <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                          <span className="kk-sm">Куда ведёт кнопка:</span>
                          <button className="kk-btn kk-btn-sm"
                            disabled={funnels.length === 0}
                            title={funnels.length === 0 ? "У бота ещё нет ни одной воронки" : undefined}
                            onClick={() => setEBtnMode("funnel")}
                            style={{
                              background: eBtnMode === "funnel" ? "var(--brand-violet-12)" : "var(--n-0)",
                              border: eBtnMode === "funnel" ? "1.5px solid var(--brand-violet)" : "1px solid var(--n-200)",
                              color: eBtnMode === "funnel" ? "var(--brand-violet)" : "var(--n-700)",
                              fontWeight: eBtnMode === "funnel" ? 600 : 500,
                              opacity: funnels.length === 0 ? 0.5 : 1,
                              cursor: funnels.length === 0 ? "not-allowed" : "pointer",
                            }}>
                            в бота (воронка){funnels.length === 0 ? " — нет воронок" : ""}
                          </button>
                          <button className="kk-btn kk-btn-sm"
                            onClick={() => setEBtnMode("url")}
                            style={{
                              background: eBtnMode === "url" ? "var(--brand-violet-12)" : "var(--n-0)",
                              border: eBtnMode === "url" ? "1.5px solid var(--brand-violet)" : "1px solid var(--n-200)",
                              color: eBtnMode === "url" ? "var(--brand-violet)" : "var(--n-700)",
                              fontWeight: eBtnMode === "url" ? 600 : 500,
                            }}>
                            произвольная ссылка
                          </button>
                        </div>

                        {eBtnMode === "funnel" && funnels.length > 0 && (
                          <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                            <span className="kk-sm kk-muted">Воронка:</span>
                            <select className="kk-input kk-btn-sm" style={{ minWidth: 200 }}
                              value={eFunnelId} onChange={(e) => setEFunnelId(e.target.value)}>
                              {funnels.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}{f.is_default ? " (по умолчанию)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {eBtnMode === "url" && (
                          <input className="kk-input kk-btn-sm" type="url"
                            placeholder="https://..."
                            value={eBtnUrl}
                            onChange={(e) => setEBtnUrl(e.target.value)}
                            style={{ fontFamily: "var(--font-mono)", fontSize: 13 }} />
                        )}

                        {eBtnMode === "funnel" && (
                          <MiniappToggle
                            on={eUseMiniapp}
                            onChange={setEUseMiniapp}
                            subscribeMsg={eSubscribeMsg}
                            setSubscribeMsg={setESubscribeMsg}
                          />
                        )}
                      </div>
                    )}
                    <div className="kk-row kk-gap-2" style={{ marginTop: 10, alignItems: "center" }}>
                      <input type="checkbox" id="e-disable-link"
                        checked={eDisableLinkPreview}
                        onChange={(e) => setEDisableLinkPreview(e.target.checked)} />
                      <label htmlFor="e-disable-link" className="kk-sm" style={{ cursor: "pointer" }}>
                        Не показывать превью ссылок
                      </label>
                    </div>
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--n-25)" }}>
                      <PostMediaBlock botId={botId}
                        kind={eMediaKind} setKind={setEMediaKind}
                        token={eMediaToken} name={eMediaName} thumb={eMediaThumb}
                        onPick={(a) => { setEMediaToken(a.token); setEMediaName(a.name); setEMediaThumb(a.thumbnail_url); }}
                        onClear={() => { setEMediaToken(null); setEMediaName(null); setEMediaThumb(null); }} />
                      <div className="kk-xs kk-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                        Если у поста уже есть медиа — добавление нового заменит его.
                        Если оставить пусто — MAX может убрать существующее (это зависит от его API).
                      </div>
                    </div>
                    <div className="kk-row kk-gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
                      <button className="kk-btn kk-btn-outline" onClick={() => setPreviewMode("edit")} disabled={saving}>
                        <Icon name="eye" size={14} /> Превью
                      </button>
                      <button className="kk-btn kk-btn-accent" onClick={saveEdit} disabled={saving}
                        style={{ opacity: saving ? 0.6 : 1 }}>
                        {saving ? "Сохраняю…" : "Сохранить в канале"}
                      </button>
                      <button className="kk-btn kk-btn-ghost" onClick={() => setEditMid(null)}>Отмена</button>
                    </div>
                  </div>
                ) : (
                  <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start" }}>
                    {p.mediaThumb ? (
                      <img src={p.mediaThumb} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    ) : p.mediaKind ? (
                      <div style={{ width: 64, height: 64, borderRadius: 8, background: "var(--n-100)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--n-500)", fontSize: 10 }}>
                        {p.mediaKind}
                      </div>
                    ) : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 88, overflow: "hidden" }}>
                        {p.text || "(без текста)"}
                      </div>
                      <div className="kk-row kk-gap-3" style={{ marginTop: 8, flexWrap: "wrap" }}>
                        <span className="kk-xs kk-muted"><Icon name="eye" size={11} /> {p.views ?? 0}</span>
                        {p.mediaKind && (
                          <span className="kk-chip" style={{ height: 18, fontSize: 10, background: "var(--brand-violet-12)", color: "var(--brand-violet)" }}>
                            {p.mediaKind}
                          </span>
                        )}
                        {p.hasButton
                          ? <span className="kk-chip kk-chip-green" style={{ height: 18, fontSize: 10 }}>магнит-кнопка есть</span>
                          : <span className="kk-chip" style={{ height: 18, fontSize: 10 }}>без кнопки</span>}
                      </div>
                    </div>
                    <button className="kk-btn kk-btn-outline kk-btn-sm" onClick={() => startEdit(p)}>
                      <Icon name="edit" size={12} /> Редактировать
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Превью поста ─── */}
      {previewMode && (
        <PostPreviewModal
          text={previewMode === "new" ? nText : eText}
          buttonText={(previewMode === "new" ? nBtn : eBtn)
            ? (previewMode === "new" ? nBtnText : eBtnText) : null}
          mediaThumb={previewMode === "new" ? nMediaThumb : eMediaThumb}
          mediaKind={previewMode === "new" ? nMediaKind : eMediaKind}
          channelName={bots.find((b) => b.id === botId)?.channel_title ?? "Канал"}
          confirmLabel={previewMode === "new"
            ? (nSchedule ? "Запланировать" : "Опубликовать")
            : "Сохранить в канале"}
          working={publishing || saving}
          onClose={() => setPreviewMode(null)}
          onConfirm={() => {
            if (previewMode === "new") publishNew();
            else saveEdit();
            setPreviewMode(null);
          }}
        />
      )}
    </Shell>
  );
}

/** Простой рендер MAX-markdown в массив React-узлов.
 * Поддерживает: **жирный**, _курсив_, ++подчёркнутый++, ~~зачёркнутый~~,
 * `моно`, [текст](url). Парс линейный, без вложенности (как в MAX). */
function renderMarkdown(raw: string): React.ReactNode {
  if (!raw) return null;
  const out: React.ReactNode[] = [];
  let i = 0;
  let buf = "";
  const flush = () => { if (buf) { out.push(buf); buf = ""; } };

  // [текст](url) → линк
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/y;

  while (i < raw.length) {
    const ch = raw[i];
    const next2 = raw.substr(i, 2);
    // ** жирный **
    if (next2 === "**") {
      const end = raw.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push(<b key={out.length}>{renderMarkdown(raw.slice(i + 2, end))}</b>);
        i = end + 2;
        continue;
      }
    }
    // ++ подчёркнутый ++
    if (next2 === "++") {
      const end = raw.indexOf("++", i + 2);
      if (end > i + 2) {
        flush();
        out.push(<u key={out.length}>{renderMarkdown(raw.slice(i + 2, end))}</u>);
        i = end + 2;
        continue;
      }
    }
    // ~~ зачёркнутый ~~
    if (next2 === "~~") {
      const end = raw.indexOf("~~", i + 2);
      if (end > i + 2) {
        flush();
        out.push(<s key={out.length}>{renderMarkdown(raw.slice(i + 2, end))}</s>);
        i = end + 2;
        continue;
      }
    }
    // _ курсив _ (только если перед нет буквы/цифры — чтобы не ломать ссылки)
    if (ch === "_" && (i === 0 || !/[\wа-яё]/i.test(raw[i - 1]))) {
      const end = raw.indexOf("_", i + 1);
      if (end > i + 1) {
        flush();
        out.push(<i key={out.length}>{renderMarkdown(raw.slice(i + 1, end))}</i>);
        i = end + 1;
        continue;
      }
    }
    // ` моно `
    if (ch === "`") {
      const end = raw.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push(<code key={out.length} style={{
          background: "rgba(124,92,255,.15)", padding: "1px 5px", borderRadius: 4,
          fontFamily: "ui-monospace, monospace", fontSize: "0.92em",
        }}>{raw.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    // [текст](url)
    linkRe.lastIndex = i;
    const lm = linkRe.exec(raw);
    if (lm) {
      flush();
      out.push(<a key={out.length} href={lm[2]} target="_blank" rel="noreferrer"
        style={{ color: "#5B9DFF", textDecoration: "underline" }}>{lm[1]}</a>);
      i = linkRe.lastIndex;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

function PostPreviewModal({
  text, buttonText, mediaThumb, mediaKind, channelName,
  confirmLabel, working, onClose, onConfirm,
}: {
  text: string;
  buttonText: string | null;
  mediaThumb: string | null;
  mediaKind: MediaKind;
  channelName: string;
  confirmLabel: string;
  working: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(15,18,22,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, backdropFilter: "blur(6px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--n-0)", borderRadius: 16, maxWidth: 460, width: "100%",
        maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div className="kk-row" style={{ padding: 16, borderBottom: "1px solid var(--n-100)", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 15 }}>Превью поста</strong>
          <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Имитация MAX-чата канала */}
        <div style={{
          padding: 18, background: "#101418",
          backgroundImage: "radial-gradient(ellipse at top, rgba(124,92,255,0.06), transparent 60%)",
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg,#2E7DFF,#1EC8FF)",
              color: "#fff", display: "grid", placeItems: "center", flexShrink: 0,
              fontWeight: 700, fontSize: 14,
            }}>{channelName.slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#7C5CFF", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {channelName}
              </div>
              <div style={{
                background: "#1a1e25", borderRadius: 14,
                padding: 12, color: "#eaeef3", overflow: "hidden",
              }}>
                {mediaThumb ? (
                  <img src={mediaThumb} alt="" style={{
                    width: "100%", borderRadius: 8, marginBottom: 10, maxHeight: 280,
                    objectFit: "cover", display: "block",
                  }} />
                ) : mediaKind && (
                  <div style={{
                    background: "#2a2f38", borderRadius: 8, padding: "30px 12px",
                    textAlign: "center", color: "#9aa4b1", marginBottom: 10, fontSize: 12,
                  }}>
                    [{mediaKind}]
                  </div>
                )}
                <div style={{
                  whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5,
                  wordBreak: "break-word",
                }}>{text ? renderMarkdown(text) : "(пусто)"}</div>
                {buttonText && (
                  <div style={{
                    marginTop: 10, padding: "10px 14px",
                    background: "#2E7DFF", color: "#fff", borderRadius: 10,
                    textAlign: "center", fontWeight: 600, fontSize: 14,
                  }}>{buttonText}</div>
                )}
                <div style={{ color: "#6a7382", fontSize: 11, marginTop: 8, textAlign: "right" }}>
                  сейчас
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="kk-row kk-gap-2" style={{ padding: 16, justifyContent: "flex-end" }}>
          <button className="kk-btn kk-btn-ghost" onClick={onClose} disabled={working}>
            Назад редактировать
          </button>
          <button className="kk-btn kk-btn-accent" onClick={onConfirm} disabled={working}>
            {working ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
      <div style={{ width: 32, height: 18, borderRadius: 99, background: on ? "var(--brand-violet)" : "var(--n-200)", position: "relative" }}>
        <div style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 99, background: "#fff" }} />
      </div>
    </button>
  );
}

function PostMediaBlock({
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
  return (
    <div>
      <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label className="kk-label" style={{ margin: 0 }}>Медиа в посте</label>
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

// Тумблер «проверять подписку в мини-аппе».
// ON  → кнопка ведёт на `?startapp=pc_<id>`, откроется мини-апп с попапом подписки → магнит
// OFF → кнопка ведёт на `?start=<trigger>` прямо в бота, там воронка сама делает проверку
function MiniappToggle({
  on, onChange, subscribeMsg, setSubscribeMsg,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  subscribeMsg: string;
  setSubscribeMsg: (v: string) => void;
}) {
  return (
    <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: "var(--n-0)", border: "1px solid var(--n-100)" }}>
      <label className="kk-row kk-gap-2" style={{ alignItems: "center", cursor: "pointer" }}>
        <Toggle on={on} onChange={onChange} />
        <span className="kk-sm" style={{ fontWeight: 500 }}>
          Проверять подписку во всплывающем окне канала (мини-апп)
        </span>
      </label>
      <div className="kk-xs kk-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
        {on
          ? "Юзер нажмёт кнопку — увидит попап прямо в канале, подпишется одним тапом, потом получит магнит в боте."
          : "Юзер нажмёт кнопку — сразу откроется чат с ботом. Бот сам попросит подписаться на канал и отдаст магнит. Не ломается о белые списки MAX."}
      </div>
      {on && (
        <>
          <label className="kk-label" style={{ marginTop: 10 }}>
            Текст «подпишись на канал» в мини-аппе (если ещё не подписан)
          </label>
          <textarea className="kk-input"
            rows={5}
            placeholder={"🔒 Материал доступен только подписчикам канала.\n\nЧтобы получить:\n\n1. Подпишись на канал\n2. Нажми «Я подписался — проверить»"}
            value={subscribeMsg}
            onChange={(e) => setSubscribeMsg(e.target.value)}
            style={{ resize: "vertical", padding: 10, fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, minHeight: 100 }} />
          <div className="kk-xs kk-muted" style={{ lineHeight: 1.5, marginTop: 4 }}>
            Перекрывает дефолтный текст «проверки подписки» из воронки только для юзеров, пришедших по кнопке этого поста.
          </div>
        </>
      )}
    </div>
  );
}
