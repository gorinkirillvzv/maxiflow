"use client";
// Кабинет: редактор Mini App. Один Mini App на бота — редактируем
// bots.mini_app_config (JSON-объект типа MiniAppConfig). Левая колонка —
// форма (заголовок, описание, CTA, картинка, цвет, тема), правая — живой
// preview в iPhone-рамке через <MiniAppRenderer>. Публичная точка входа —
// /m/<username>. Кнопка «Открыть Mini App» уводит туда с ?preview=1.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { SectionTitle } from "@/components/ui";
import { MediaPicker, type MediaAsset } from "@/components/MediaPicker";
import MiniAppRenderer from "@/components/MiniAppRenderer";
import {
  DEFAULT_CONFIG,
  type MiniAppConfig,
  type MiniAppCtaKind,
} from "@/lib/mini-app/config";

interface BotRow {
  id: string;
  max_bot_username: string;
  channel_id: string | null;
  channel_title: string | null;
  channel_link: string | null;
  is_active: boolean;
  mini_app_config: MiniAppConfig | null;
  mini_app_updated_at: string | null;
}

const CABINET_URL = process.env.NEXT_PUBLIC_APP_URL || "";

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Violet", value: "#5B47FB" },
  { label: "Coral",  value: "#FF6B57" },
  { label: "Amber",  value: "#FFB020" },
  { label: "Green",  value: "#00B956" },
  { label: "Dark",   value: "#15141C" },
];

/** Нормализуем произвольный объект из БД к полной MiniAppConfig — заполняем
 *  пропущенные поля из DEFAULT_CONFIG, чтобы форма не падала на undefined. */
function normalize(raw: MiniAppConfig | null | undefined): MiniAppConfig {
  const src: Partial<MiniAppConfig> = raw ?? {};
  return {
    title:            src.title            ?? DEFAULT_CONFIG.title,
    description:      src.description      ?? DEFAULT_CONFIG.description,
    ctaText:          src.ctaText          ?? DEFAULT_CONFIG.ctaText,
    ctaKind:          (src.ctaKind as MiniAppCtaKind) ?? DEFAULT_CONFIG.ctaKind,
    ctaStartCommand:  src.ctaStartCommand  ?? DEFAULT_CONFIG.ctaStartCommand ?? "",
    ctaUrl:           src.ctaUrl           ?? "",
    imageUrl:         src.imageUrl         ?? "",
    brandColor:       src.brandColor       ?? "#5B47FB",
    theme:            src.theme            ?? DEFAULT_CONFIG.theme ?? "dark",
  };
}

function isDirty(a: MiniAppConfig, b: MiniAppConfig): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export default function MiniAppPage() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [config, setConfig] = useState<MiniAppConfig>(normalize(null));
  const [initialConfig, setInitialConfig] = useState<MiniAppConfig>(normalize(null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Загружаем ботов один раз.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/mini-app");
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) {
          setLoadError(d.error || "Не удалось загрузить ботов");
          return;
        }
        const list: BotRow[] = d.bots ?? [];
        setBots(list);
        const preferred = list.find((b) => b.is_active) ?? list[0];
        if (preferred) {
          setSelectedId(preferred.id);
          const cfg = normalize(preferred.mini_app_config);
          setConfig(cfg);
          setInitialConfig(cfg);
        }
      } catch (e) {
        if (!alive) return;
        setLoadError(e instanceof Error ? e.message : "Ошибка сети");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(
    () => bots.find((b) => b.id === selectedId) ?? null,
    [bots, selectedId],
  );

  const dirty = useMemo(() => isDirty(config, initialConfig), [config, initialConfig]);

  // beforeunload — не даём случайно потерять несохранённые правки.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const handleSelectBot = useCallback(
    (id: string) => {
      if (dirty && !confirm("Есть несохранённые изменения. Переключиться на другого бота и потерять их?")) {
        return;
      }
      setSelectedId(id);
      const bot = bots.find((b) => b.id === id);
      const cfg = normalize(bot?.mini_app_config ?? null);
      setConfig(cfg);
      setInitialConfig(cfg);
      setSaveOk(false);
      setSaveError(null);
    },
    [bots, dirty],
  );

  // Патчер конфига — сбрасываем «сохранено» на любое изменение.
  function patch<K extends keyof MiniAppConfig>(key: K, value: MiniAppConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setSaveOk(false);
  }

  function validate(): string | null {
    if (!config.title.trim()) return "Заполни заголовок";
    if (!config.description.trim()) return "Заполни описание";
    if (!config.ctaText.trim()) return "Заполни текст кнопки";
    if (config.ctaKind === "url" && !(config.ctaUrl ?? "").trim()) return "Укажи URL для CTA";
    return null;
  }

  async function handleSave() {
    if (!selected) return;
    const err = validate();
    if (err) {
      setSaveError(err);
      setSaveOk(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      // Отправляем только релевантные поля: если тип CTA не url — не тащим ctaUrl.
      const payload: MiniAppConfig = {
        title:       config.title.trim(),
        description: config.description.trim(),
        ctaText:     config.ctaText.trim(),
        ctaKind:     config.ctaKind,
        theme:       config.theme,
        brandColor:  config.brandColor,
        imageUrl:    (config.imageUrl ?? "").trim() || undefined,
        ctaStartCommand: config.ctaKind === "bot"
          ? (config.ctaStartCommand ?? "").trim() || undefined
          : undefined,
        ctaUrl:      config.ctaKind === "url"
          ? (config.ctaUrl ?? "").trim() || undefined
          : undefined,
      };
      const r = await fetch("/api/mini-app", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: selected.id, config: payload }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Ошибка сохранения");
      // Обновляем локальный кэш bots и baseline для dirty-check.
      const savedAt = (d.bot && d.bot.mini_app_updated_at) || new Date().toISOString();
      setBots((prev) =>
        prev.map((b) =>
          b.id === selected.id
            ? { ...b, mini_app_config: payload, mini_app_updated_at: savedAt }
            : b,
        ),
      );
      setInitialConfig(payload);
      setConfig(payload);
      setSaveOk(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const publicUrl = selected
    ? `${CABINET_URL}/m/${selected.max_bot_username}?preview=1`
    : "";

  return (
    <Shell active="mini-app" title="Mini App" breadcrumbs={["Контент", "Mini App"]}>
      <div style={{ padding: "20px 24px" }}>
        <div
          className="kk-row"
          style={{ justifyContent: "space-between", marginBottom: 14, gap: 16 }}
        >
          <SectionTitle sub="одностраничник для карточки бота в MAX — заголовок, описание, кнопка. Показывается по /m/<username>.">
            Mini App
          </SectionTitle>
        </div>

        {loadError && (
          <div
            className="kk-sm"
            style={{
              marginBottom: 12,
              color: "var(--danger)",
              background: "var(--brand-coral-12)",
              padding: "8px 12px",
              borderRadius: 8,
            }}
          >
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="kk-muted kk-sm">Загружаем…</div>
        ) : bots.length === 0 ? (
          <div
            className="kk-card kk-pad-5 kk-muted kk-sm"
            style={{ textAlign: "center" }}
          >
            Сначала подключи бота — тогда сможешь собрать для него Mini App.
          </div>
        ) : (
          <>
            {/* Селектор бота */}
            <div
              className="kk-card kk-pad-4"
              style={{ marginBottom: 16, maxWidth: 640 }}
            >
              <label className="kk-label">Бот</label>
              <select
                className="kk-input"
                style={{ width: "100%", marginTop: 4 }}
                value={selectedId}
                onChange={(e) => handleSelectBot(e.target.value)}
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.channel_title ?? b.max_bot_username} · @{b.max_bot_username}
                    {b.is_active ? "" : " (выключен)"}
                  </option>
                ))}
              </select>
              {selected && (
                <div
                  className="kk-xs kk-muted"
                  style={{ marginTop: 8, lineHeight: 1.5 }}
                >
                  публичный URL: <b>/m/{selected.max_bot_username}</b>
                  {selected.mini_app_updated_at && (
                    <>
                      {" · обновлён "}
                      {new Date(selected.mini_app_updated_at).toLocaleString("ru-RU")}
                    </>
                  )}
                </div>
              )}
            </div>

            {selected && (
              <EditorLayout
                bot={selected}
                config={config}
                onPatch={patch}
                onSave={handleSave}
                onReset={() => {
                  setConfig(initialConfig);
                  setSaveError(null);
                  setSaveOk(false);
                }}
                saving={saving}
                saveError={saveError}
                saveOk={saveOk}
                dirty={dirty}
                publicUrl={publicUrl}
              />
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

/* --------------------------------------------------------------------------
 * EditorLayout — двухколонник (форма слева, preview справа).
 * На мобиле складывается в один столбец (форма сверху, preview снизу).
 * ------------------------------------------------------------------------ */
function EditorLayout({
  bot, config, onPatch, onSave, onReset, saving, saveError, saveOk, dirty, publicUrl,
}: {
  bot: BotRow;
  config: MiniAppConfig;
  onPatch: <K extends keyof MiniAppConfig>(k: K, v: MiniAppConfig[K]) => void;
  onSave: () => void | Promise<void>;
  onReset: () => void;
  saving: boolean;
  saveError: string | null;
  saveOk: boolean;
  dirty: boolean;
  publicUrl: string;
}) {
  return (
    <div className="mini-editor-grid">
      {/* Форма */}
      <div className="kk-col" style={{ gap: 16, minWidth: 0 }}>
        {/* Основное */}
        <div className="kk-card kk-pad-5">
          <div className="kk-h4" style={{ marginBottom: 4 }}>Контент</div>
          <div className="kk-xs kk-muted" style={{ marginBottom: 14 }}>
            Что увидит человек, открывший карточку бота в MAX.
          </div>

          <div className="kk-col" style={{ gap: 12 }}>
            <div className="kk-col" style={{ gap: 6 }}>
              <label className="kk-label">Заголовок</label>
              <input
                className="kk-input"
                value={config.title}
                onChange={(e) => onPatch("title", e.target.value)}
                placeholder="Банкротство с Гориным"
              />
            </div>

            <div className="kk-col" style={{ gap: 6 }}>
              <label className="kk-label">Описание</label>
              <textarea
                className="kk-input"
                rows={4}
                style={{ height: "auto", padding: "10px 12px", lineHeight: 1.5, resize: "vertical" }}
                value={config.description}
                onChange={(e) => onPatch("description", e.target.value)}
                placeholder="Помогу списать долги через МФЦ или через суд..."
              />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="kk-card kk-pad-5">
          <div className="kk-h4" style={{ marginBottom: 4 }}>Кнопка (CTA)</div>
          <div className="kk-xs kk-muted" style={{ marginBottom: 14 }}>
            Куда ведёт основная кнопка. Совет: «в бота» — если магнит выдаёт бот; «в канал» — чтобы подписать; «URL» — на лендинг/форму.
          </div>

          <div className="kk-col" style={{ gap: 12 }}>
            <div className="kk-col" style={{ gap: 6 }}>
              <label className="kk-label">Текст на кнопке</label>
              <input
                className="kk-input"
                value={config.ctaText}
                onChange={(e) => onPatch("ctaText", e.target.value)}
                placeholder="Открыть чат с юристом"
              />
            </div>

            <div className="kk-col" style={{ gap: 6 }}>
              <label className="kk-label">Куда ведёт</label>
              <div className="kk-tabs" style={{ alignSelf: "flex-start" }}>
                <button
                  type="button"
                  className="kk-tab"
                  data-active={config.ctaKind === "bot"}
                  onClick={() => onPatch("ctaKind", "bot")}
                >В бота</button>
                <button
                  type="button"
                  className="kk-tab"
                  data-active={config.ctaKind === "channel"}
                  onClick={() => onPatch("ctaKind", "channel")}
                >В канал</button>
                <button
                  type="button"
                  className="kk-tab"
                  data-active={config.ctaKind === "url"}
                  onClick={() => onPatch("ctaKind", "url")}
                >Произвольный URL</button>
              </div>
            </div>

            {config.ctaKind === "bot" && (
              <div className="kk-col" style={{ gap: 6 }}>
                <label className="kk-label">
                  Start-команда (опц.) — попадёт в <code>?start=</code>
                </label>
                <input
                  className="kk-input"
                  value={config.ctaStartCommand ?? ""}
                  onChange={(e) => onPatch("ctaStartCommand", e.target.value)}
                  placeholder="например: promo_2026"
                />
                <div className="kk-xs kk-muted">
                  Откроется <b>@{bot.max_bot_username}</b>
                  {(config.ctaStartCommand ?? "").trim()
                    ? ` со стартом «${(config.ctaStartCommand ?? "").trim()}»`
                    : ""}
                </div>
              </div>
            )}

            {config.ctaKind === "url" && (
              <div className="kk-col" style={{ gap: 6 }}>
                <label className="kk-label">URL</label>
                <input
                  className="kk-input"
                  value={config.ctaUrl ?? ""}
                  onChange={(e) => onPatch("ctaUrl", e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            )}

            {config.ctaKind === "channel" && (
              <div className="kk-xs kk-muted">
                Откроется{" "}
                <b>
                  {bot.channel_title
                    ? `«${bot.channel_title}»`
                    : bot.channel_link ?? "канал (не настроен)"}
                </b>
                {!bot.channel_link && !bot.channel_title && (
                  <>
                    {" · "}
                    <span style={{ color: "var(--danger)" }}>
                      у бота не привязан канал — этот вариант работать не будет
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Оформление */}
        <div className="kk-card kk-pad-5">
          <div className="kk-h4" style={{ marginBottom: 4 }}>Оформление</div>
          <div className="kk-xs kk-muted" style={{ marginBottom: 14 }}>
            Цвет акцента используется в кнопке и заливках. Тема меняет фон Mini App.
          </div>

          <div className="kk-col" style={{ gap: 16 }}>
            <div className="kk-col" style={{ gap: 8 }}>
              <label className="kk-label">Цвет акцента</label>
              <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                {COLOR_PRESETS.map((p) => {
                  const active = (config.brandColor ?? "").toLowerCase() === p.value.toLowerCase();
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onPatch("brandColor", p.value)}
                      title={`${p.label} · ${p.value}`}
                      aria-label={p.label}
                      style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: p.value,
                        border: active ? "2px solid var(--brand-ink)" : "2px solid transparent",
                        boxShadow: active ? "0 0 0 2px var(--n-0), 0 0 0 4px var(--brand-ink)" : "var(--shadow-1)",
                        cursor: "pointer", padding: 0,
                      }}
                    />
                  );
                })}
                <label
                  className="kk-row kk-gap-2"
                  style={{
                    marginLeft: 6,
                    padding: "4px 8px 4px 4px",
                    borderRadius: 10,
                    background: "var(--n-50)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="color"
                    value={config.brandColor ?? "#5B47FB"}
                    onChange={(e) => onPatch("brandColor", e.target.value)}
                    style={{
                      width: 26, height: 26, border: 0, padding: 0, borderRadius: 8,
                      background: "none", cursor: "pointer",
                    }}
                  />
                  <span className="kk-xs kk-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {(config.brandColor ?? "").toUpperCase()}
                  </span>
                </label>
              </div>
            </div>

            <div className="kk-col" style={{ gap: 8 }}>
              <label className="kk-label">Тема</label>
              <div className="kk-tabs" style={{ alignSelf: "flex-start" }}>
                <button
                  type="button"
                  className="kk-tab"
                  data-active={config.theme === "dark"}
                  onClick={() => onPatch("theme", "dark")}
                >Тёмная</button>
                <button
                  type="button"
                  className="kk-tab"
                  data-active={config.theme === "light"}
                  onClick={() => onPatch("theme", "light")}
                >Светлая</button>
              </div>
            </div>

            <div className="kk-col" style={{ gap: 6 }}>
              <label className="kk-label">Hero-картинка (опц.)</label>
              {config.imageUrl ? (
                <div
                  className="kk-row kk-gap-3"
                  style={{
                    padding: 8, borderRadius: 10, background: "var(--n-50)",
                    border: "1px solid var(--n-100)",
                  }}
                >
                  <img
                    src={config.imageUrl}
                    alt=""
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                  />
                  <div className="kk-xs kk-muted" style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>
                    {config.imageUrl}
                  </div>
                  <button
                    className="kk-btn kk-btn-ghost kk-btn-sm"
                    onClick={() => onPatch("imageUrl", undefined)}
                  >Убрать</button>
                </div>
              ) : (
                <div className="kk-xs kk-muted">
                  Выбери или загрузи картинку в библиотеке ниже.
                </div>
              )}
              <MediaPicker
                botId={bot.id}
                kind="image"
                selectedToken={undefined}
                onPick={(a: MediaAsset) => {
                  // MediaPicker возвращает asset; ссылка на публично-доступный превью
                  // хранится в thumbnail_url. Если его нет — берём token как fallback.
                  const url = a.thumbnail_url || "";
                  if (url) onPatch("imageUrl", url);
                }}
              />
            </div>
          </div>
        </div>

        {/* Ошибки/успех */}
        {saveError && (
          <div
            className="kk-sm"
            style={{
              color: "var(--danger)", background: "var(--brand-coral-12)",
              padding: "8px 12px", borderRadius: 8,
            }}
          >
            {saveError}
          </div>
        )}
        {saveOk && !dirty && (
          <div
            className="kk-sm"
            style={{
              color: "#0A7A3C", background: "var(--success-12)",
              padding: "8px 12px", borderRadius: 8,
            }}
          >
            Сохранено
          </div>
        )}

        {/* Bottom-панель действий */}
        <div
          className="kk-row kk-gap-3"
          style={{ flexWrap: "wrap", padding: "4px 2px 24px" }}
        >
          <button
            className="kk-btn kk-btn-accent kk-btn-lg"
            onClick={onSave}
            disabled={saving || !dirty}
            style={{ opacity: saving || !dirty ? 0.6 : 1 }}
          >
            {saving ? "Сохраняю…" : dirty ? "Сохранить" : "Сохранено"}
          </button>
          {dirty && (
            <button
              className="kk-btn kk-btn-ghost"
              onClick={onReset}
              disabled={saving}
            >Отменить изменения</button>
          )}
          <div style={{ flex: 1 }} />
          <a
            className="kk-btn kk-btn-outline"
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
          >Открыть Mini App ↗</a>
        </div>
      </div>

      {/* Preview */}
      <div className="mini-editor-preview">
        <PhonePreview
          config={config}
          bot={bot}
        />
      </div>

      <style jsx>{`
        .mini-editor-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: start;
        }
        .mini-editor-preview {
          position: sticky;
          top: 20px;
        }
        @media (max-width: 1100px) {
          .mini-editor-grid { grid-template-columns: 1fr; }
          .mini-editor-preview {
            position: static;
            display: flex;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * PhonePreview — iPhone-мокап с notch, статус-баром и home-indicator,
 * внутри — рендер Mini App в масштабе 0.6 (реальный размер 375×760).
 * ------------------------------------------------------------------------ */
function PhonePreview({ config, bot }: { config: MiniAppConfig; bot: BotRow }) {
  // Реальные размеры контента: соотношение iPhone (~19.5:9).
  const contentWidth = 375;
  const contentHeight = 760;
  const scale = 0.62;

  const frameWidth = contentWidth * scale + 20;   // +padding «корпуса»
  const frameHeight = contentHeight * scale + 20;

  return (
    <div className="kk-col" style={{ gap: 10, alignItems: "center" }}>
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          borderRadius: 44,
          padding: 10,
          background: "linear-gradient(160deg, #2b2933 0%, #15141C 100%)",
          boxShadow:
            "0 24px 60px rgba(21,20,28,0.28), 0 4px 12px rgba(21,20,28,0.14), inset 0 0 0 1.5px rgba(255,255,255,0.06)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* Боковые кнопки — чисто декор */}
        <div style={{
          position: "absolute", left: -2, top: "18%", width: 3, height: 32,
          borderRadius: 2, background: "#0a0910",
        }} />
        <div style={{
          position: "absolute", left: -2, top: "28%", width: 3, height: 54,
          borderRadius: 2, background: "#0a0910",
        }} />
        <div style={{
          position: "absolute", left: -2, top: "38%", width: 3, height: 54,
          borderRadius: 2, background: "#0a0910",
        }} />
        <div style={{
          position: "absolute", right: -2, top: "26%", width: 3, height: 84,
          borderRadius: 2, background: "#0a0910",
        }} />

        {/* Экран */}
        <div
          style={{
            width: "100%", height: "100%", borderRadius: 36,
            overflow: "hidden", position: "relative",
            background: config.theme === "light" ? "#F7F6F3" : "#0f0e14",
          }}
        >
          {/* Скейлим контейнер контента, чтобы фактические 375×760 влезли в рамку */}
          <div
            style={{
              width: contentWidth,
              height: contentHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "absolute", top: 0, left: 0,
            }}
          >
            <MiniAppRenderer
              config={config}
              botUsername={bot.max_bot_username}
              channelLink={bot.channel_link}
              preview
            />
          </div>

          {/* Notch (Dynamic Island стиль) */}
          <div style={{
            position: "absolute",
            top: 8, left: "50%", transform: "translateX(-50%)",
            width: 96, height: 26, borderRadius: 999,
            background: "#000",
            boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
            zIndex: 5,
            pointerEvents: "none",
          }} />

          {/* Home indicator */}
          <div style={{
            position: "absolute",
            bottom: 6, left: "50%", transform: "translateX(-50%)",
            width: 108, height: 4, borderRadius: 99,
            background: config.theme === "light" ? "rgba(21,20,28,0.35)" : "rgba(255,255,255,0.45)",
            zIndex: 5,
            pointerEvents: "none",
          }} />
        </div>
      </div>

      <div className="kk-xs kk-muted" style={{ textAlign: "center" }}>
        Живой preview · 375×760 @ {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
