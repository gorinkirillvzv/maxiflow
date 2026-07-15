"use client";
// Picker для библиотеки media_assets. Заполняется автоматически —
// владелец бота пересылает в ЛС бота кружок/голосовое/файл, токен сохраняется.
// Чтобы бот не сохранял случайные сообщения от подписчиков, владелец
// сначала привязывает свой MAX-аккаунт по одноразовой ссылке (link-токен).
import { useCallback, useEffect, useRef, useState } from "react";

export type MediaAsset = {
  id: string;
  bot_id: string;
  kind: string;
  token: string;
  name: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  size_bytes: number | null;
  created_at: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / (1024 * 1024)).toFixed(1)} МБ`;
}

type Admin = { max_user_id: number; added_at: string };

export function MediaPicker({
  botId, kind, selectedToken, onPick,
}: {
  botId: string;
  kind: string;
  selectedToken?: string;
  onPick: (asset: MediaAsset) => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // MAX upload endpoint поддерживает только эти типы. video_note/sticker — только через пересылку.
  const isUploadable = ["image", "video", "audio", "file"].includes(kind);
  const acceptAttr =
    kind === "image" ? "image/*" :
    kind === "video" ? "video/*" :
    kind === "audio" ? "audio/*" :
    undefined;

  const load = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [m, a] = await Promise.all([
        fetch(`/api/media?bot_id=${botId}&kind=${kind}`).then((r) => r.json()),
        fetch(`/api/bot-link?bot_id=${botId}`).then((r) => r.json()),
      ]);
      setAssets(m.media ?? []);
      setAdmins(a.admins ?? []);
    } finally {
      setLoading(false);
    }
  }, [botId, kind]);

  useEffect(() => { load(); }, [load]);

  async function makeLink() {
    if (!botId) return;
    setLinking(true);
    try {
      const r = await fetch("/api/bot-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId }),
      });
      const d = await r.json();
      if (r.ok) setLinkUrl(d.link);
    } finally {
      setLinking(false);
    }
  }

  async function unlink(adminId: number) {
    if (!confirm("Отвязать этого админа?")) return;
    await fetch(`/api/bot-link?bot_id=${botId}&max_user_id=${adminId}`, { method: "DELETE" });
    setAdmins((xs) => xs.filter((x) => x.max_user_id !== adminId));
  }

  async function remove(id: string) {
    await fetch(`/api/media?id=${id}`, { method: "DELETE" });
    setAssets((a) => a.filter((x) => x.id !== id));
  }

  async function onUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !botId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("bot_id", botId);
      fd.append("kind", kind);
      const r = await fetch("/api/media/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка загрузки");
      // обновляем список и автоматически выбираем загруженный
      await load();
      if (d.asset?.token) onPick(d.asset);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <label className="kk-label" style={{ margin: 0 }}>Выбор из библиотеки</label>
        <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={load} disabled={loading}>
          {loading ? "…" : "Обновить"}
        </button>
      </div>

      {admins.length === 0 ? (
        <div className="kk-card kk-pad-3 kk-xs" style={{ lineHeight: 1.5, background: "var(--brand-amber-12)", marginBottom: 8 }}>
          <div style={{ marginBottom: 6 }}>
            <b>Сначала привяжи свой MAX-аккаунт.</b> Иначе бот не отличит твои
            кружки от случайных сообщений подписчиков и не сохранит их.
          </div>
          {linkUrl ? (
            <>
              <div style={{ marginBottom: 6 }}>Открой ссылку на своём устройстве (одноразовая, действует 1 час):</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <a href={linkUrl} target="_blank" rel="noreferrer"
                  className="kk-btn kk-btn-accent kk-btn-sm">Открыть в MAX</a>
                <button className="kk-btn kk-btn-ghost kk-btn-sm"
                  onClick={() => navigator.clipboard?.writeText(linkUrl)}>Скопировать</button>
                <code style={{ fontSize: 10, opacity: 0.7, wordBreak: "break-all" }}>{linkUrl}</code>
              </div>
            </>
          ) : (
            <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={makeLink} disabled={linking}>
              {linking ? "…" : "Привязать мой MAX-аккаунт"}
            </button>
          )}
        </div>
      ) : (
        <div className="kk-xs kk-muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>
          Привязано: {admins.length} · {admins.map((a, i) => (
            <span key={a.max_user_id}>
              {i > 0 ? " · " : ""}id{a.max_user_id}
              <button onClick={() => unlink(a.max_user_id)} title="Отвязать"
                style={{ marginLeft: 4, background: "none", border: 0, cursor: "pointer", color: "var(--n-400)" }}>×</button>
            </span>
          ))}
          <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ marginLeft: 8 }}
            onClick={makeLink} disabled={linking}>+ ещё</button>
          {linkUrl && (
            <div style={{ marginTop: 6 }}>
              <a href={linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{linkUrl}</a>
            </div>
          )}
        </div>
      )}

      {isUploadable && (
        <div style={{ marginBottom: 8 }}>
          <input ref={fileInputRef} type="file"
            accept={acceptAttr}
            style={{ display: "none" }}
            onChange={onUploadChange} />
          <button className="kk-btn kk-btn-accent kk-btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !botId}
            style={{ opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "Загружаю…" : "+ Загрузить с компа"}
          </button>
          {uploadError && (
            <div className="kk-xs" style={{ color: "var(--danger)", marginTop: 6 }}>{uploadError}</div>
          )}
        </div>
      )}

      {assets.length === 0 ? (
        <div className="kk-card kk-pad-3 kk-xs kk-muted" style={{ lineHeight: 1.5 }}>
          {isUploadable
            ? <>Библиотека пуста. <b>Загрузи с компьютера</b> кнопкой выше или перешли в ЛС боту с привязанного аккаунта.</>
            : <>Библиотека пуста. <b>Перешли в ЛС боту</b> с привязанного аккаунта то, что хочешь вставить (кружок/стикер — только так).</>}
        </div>
      ) : (
        <div className="kk-col kk-gap-1" style={{ maxHeight: 280, overflowY: "auto" }}>
          {assets.map((a) => {
            const isSel = a.token === selectedToken;
            return (
              <div key={a.id} className="kk-row kk-gap-2" style={{
                padding: 8, borderRadius: 8,
                background: isSel ? "var(--brand-violet-12)" : "var(--n-25)",
                border: isSel ? "1px solid var(--brand-violet)" : "1px solid transparent",
                cursor: "pointer",
              }} onClick={() => onPick(a)}>
                {a.thumbnail_url ? (
                  <img src={a.thumbnail_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--n-100)" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kk-sm" style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name ?? `${a.kind} ${a.id.slice(0, 6)}`}
                  </div>
                  <div className="kk-xs kk-muted">
                    {fmtDate(a.created_at)}
                    {a.duration_sec ? ` · ${a.duration_sec}с` : ""}
                    {a.size_bytes ? ` · ${fmtBytes(a.size_bytes)}` : ""}
                  </div>
                </div>
                <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
                  style={{ color: "var(--danger)" }}
                  onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                  aria-label="Удалить">×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
