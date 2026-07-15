"use client";
// MAX Mini App entry point: /m/<bot>
// MAX передаёт startapp payload (например `pc_abc123`) через WebApp.initDataUnsafe.start_param.
// Парсим, извлекаем pc_id и работаем как обычно.
//
// Новая логика (mini_app_config):
// 1. Если в URL есть pc_id (startapp/WebAppStartParam=pc_...) — юзер пришёл
//    из-под кнопки конкретного магнита. ВСЕГДА legacy magnet-flow (проверка
//    подписки → выдача магнита). Кастомный Mini App не должен перекрывать —
//    иначе юзер не получит материал.
// 2. Иначе — тянем /api/mini-app/public; если пришёл `mini_app_config`
//    (объект) — рендерим через <MiniAppRenderer>. Иначе — старая заглушка
//    «Привет!».
//
// Блочный конструктор (BlockList) больше не используется на этой странице —
// он остался только для лендингов в /app/landings.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MiniAppRenderer from "@/components/MiniAppRenderer";
import type { MiniAppConfig } from "@/lib/mini-app/config";

import "@/app/lp/lp.css";

type Magnet = {
  title: string;
  description: string;
  delivery_text: string;
  preview_items: string;
  file_url: string | null;
  file_name: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "placeholder" }
  | { kind: "error"; message: string }
  | {
      kind: "not_subscribed";
      subscribe_message: string;
      channel_link: string | null;
      subscribe_button_text: string;
      check_button_text: string;
    }
  | { kind: "magnet"; magnet: Magnet; deeplink: string };

declare global {
  interface Window {
    WebApp?: {
      initData?: string;
      initDataUnsafe?: {
        user?: { id: number; first_name?: string; last_name?: string; username?: string };
        query_id?: string;
        auth_date?: number;
        start_param?: string;          // payload из ?startapp=<...>
        startapp?: string;             // запасное имя, если MAX иначе называет
      };
      openMaxLink?: (url: string) => void;
      openLink?: (url: string) => void;
      ready?: () => void;
      expand?: () => void;
    };
  }
}

const SDK_URL = "https://st.max.ru/js/max-web-app.js";

function loadSdk(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    if (window.WebApp) return resolve();
    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const s = document.createElement("script");
    s.src = SDK_URL; s.async = true;
    s.onload = () => resolve(); s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

type MaxCtx = {
  pcId: string | null;
  userId: number | null;
  chatId: number | null;
  rawInitData: string;       // raw url-encoded строка для server-side HMAC
};

/** MAX передаёт WebApp данные в URL (а не только через JS SDK):
 * - query: ?WebAppStartParam=<payload>
 * - hash:  #WebAppData=<url-encoded `ip=..&user=..&start_param=..&hash=..`>
 * Парсим оба источника. */
function readMaxCtx(): MaxCtx {
  const out: MaxCtx = { pcId: null, userId: null, chatId: null, rawInitData: "" };
  if (typeof window === "undefined") return out;

  // 1) сначала ищем в JS SDK (если он всё-таки подгрузился)
  const ds = window.WebApp?.initDataUnsafe;
  if (ds?.user?.id) out.userId = ds.user.id;
  const sdkStart = ds?.start_param || ds?.startapp;
  if (sdkStart) {
    const m = sdkStart.match(/^(?:pc_)?([a-f0-9]{8,24})$/i);
    if (m) out.pcId = m[1];
  }
  if (window.WebApp?.initData) out.rawInitData = window.WebApp.initData;

  // 2) из query (?WebAppStartParam=pc_xxx или ?startapp=...)
  if (!out.pcId) {
    const u = new URL(window.location.href);
    const raw = u.searchParams.get("WebAppStartParam")
      ?? u.searchParams.get("startapp")
      ?? u.searchParams.get("start_param");
    if (raw) {
      const m = raw.match(/^(?:pc_)?([a-f0-9]{8,24})$/i);
      if (m) out.pcId = m[1];
    }
  }

  // 3) из hash `#WebAppData=<encoded>`
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (hash) {
    const outer = new URLSearchParams(hash);
    const inner = outer.get("WebAppData");
    if (inner) {
      out.rawInitData = inner; // вот это идёт на сервер для HMAC-валидации
      const innerParams = new URLSearchParams(inner);

      if (!out.pcId) {
        const sp = innerParams.get("start_param");
        if (sp) {
          const m = sp.match(/^(?:pc_)?([a-f0-9]{8,24})$/i);
          if (m) out.pcId = m[1];
        }
      }
      if (!out.userId) {
        const userJson = innerParams.get("user");
        if (userJson) {
          try {
            const u = JSON.parse(userJson);
            if (u && typeof u.id === "number") out.userId = u.id;
          } catch { /* ignore */ }
        }
      }
      const chatJson = innerParams.get("chat");
      if (chatJson) {
        try {
          const c = JSON.parse(chatJson);
          if (c && typeof c.id === "number") out.chatId = c.id;
        } catch { /* ignore */ }
      }
    }
  }

  return out;
}

type ConfigState =
  | { kind: "loading" }
  | { kind: "custom"; config: MiniAppConfig; botId: string; username: string; channelLink: string | null }
  | { kind: "legacy" };

export default function MiniAppEntry() {
  const params = useParams<{ bot: string }>();
  const bot = (params?.bot ?? "").toString();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [configState, setConfigState] = useState<ConfigState>({ kind: "loading" });

  // Загружаем конфиг Mini App один раз. Приоритет:
  //   1. Если в URL есть ?startapp=pc_XXX (или подобное) — юзер пришёл из-под кнопки
  //      конкретного поста-магнита, ВСЕГДА идёт legacy subscribe/magnet flow.
  //      Кастомный хаб бота не должен перекрывать магнит-flow — иначе юзер не получит материал.
  //   2. Если pc_id нет и у бота есть mini_app_config — рендерим кастомный Mini App.
  //   3. Иначе — legacy заглушка «Привет!».
  useEffect(() => {
    if (!bot) {
      setConfigState({ kind: "legacy" });
      return;
    }
    // Быстрая синхронная проверка pc_id из трёх источников — так же как в readMaxCtx().
    // MAX может прокинуть startapp через query, hash (#WebAppData=…) или SDK.
    // Проверять ТОЛЬКО query — недостаточно: юзер с pc_XXX увидит хаб вместо магнита.
    let hasPcId = false;
    const PC_RE = /^(?:pc_)?([a-f0-9]{8,24})$/i;
    const looksLikePc = (v: string | null | undefined) => !!v && PC_RE.test(v);
    try {
      // (1) SDK
      const sdkStart = window.WebApp?.initDataUnsafe?.start_param
        ?? window.WebApp?.initDataUnsafe?.startapp;
      if (looksLikePc(sdkStart)) hasPcId = true;

      // (2) query
      if (!hasPcId) {
        const u = new URL(window.location.href);
        const cand = u.searchParams.get("WebAppStartParam")
          ?? u.searchParams.get("startapp")
          ?? u.searchParams.get("start_param");
        if (looksLikePc(cand)) hasPcId = true;
      }

      // (3) hash: #WebAppData=<encoded url-form с полем start_param=...>
      if (!hasPcId) {
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        if (hash) {
          const outer = new URLSearchParams(hash);
          const inner = outer.get("WebAppData");
          if (inner) {
            const innerParams = new URLSearchParams(inner);
            if (looksLikePc(innerParams.get("start_param"))) hasPcId = true;
          }
        }
      }
    } catch { /* ignore */ }

    if (hasPcId) {
      setConfigState({ kind: "legacy" });
      return;
    }

    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/mini-app/public?bot=${encodeURIComponent(bot)}`);
        if (!alive) return;
        if (!r.ok) {
          setConfigState({ kind: "legacy" });
          return;
        }
        const d = await r.json();
        const cfg = d.mini_app_config;
        if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
          setConfigState({
            kind: "custom",
            config: cfg as MiniAppConfig,
            botId: d.bot_id,
            username: d.username,
            channelLink: d.channel_link ?? null,
          });
        } else {
          setConfigState({ kind: "legacy" });
        }
      } catch {
        if (!alive) return;
        setConfigState({ kind: "legacy" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [bot]);

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      // SDK не обязателен — пытаемся подгрузить, но даже без него парсим URL.
      // ready() прогревает MAX SDK — после этого openMaxLink работает с первого клика.
      await Promise.race([loadSdk(), new Promise<void>((r) => setTimeout(r, 1500))]);
      // Сигналим SDK что мы готовы — это «прогревает» openMaxLink, чтобы он работал с первого клика
      try { window.WebApp?.ready?.(); } catch { /* ignore */ }
      try { window.WebApp?.expand?.(); } catch { /* ignore */ }
    } catch { /* ignore */ }

    let ctx: MaxCtx;
    try {
      ctx = readMaxCtx();
    } catch (e) {
      setState({ kind: "error", message: "Парсер initData упал: " + (e instanceof Error ? e.message : String(e)) });
      return;
    }

    if (!ctx.pcId) {
      // Mini App открыт из карточки бота / меню, без привязки к конкретному посту.
      // Показываем заглушку, отправляем юзера в канал.
      setState({ kind: "placeholder" });
      return;
    }
    if (!ctx.userId) {
      setState({
        kind: "error",
        message: "Mini App запущен вне MAX (нет user_id).",
      });
      return;
    }

    try {
      const r = await fetch("/api/mini/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_username: bot,
          pc_id: ctx.pcId,
          user_id: ctx.userId,
          init_data: ctx.rawInitData,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setState({ kind: "error", message: d.error || "Ошибка" }); return; }
      if (d.subscribed) {
        // подписан → показываем магнит прямо в Mini App.
        // bot_username — это бот ТЕНАНТА для опционального deeplink «открыть бота для бонуса».
        const targetBot = d.bot_username || bot;
        const deeplink = `https://max.ru/${targetBot}?start=pc_${ctx.pcId}`;
        if (d.magnet) {
          setState({ kind: "magnet", magnet: d.magnet, deeplink });
        } else {
          // если магнит ещё не настроен — fallback на старое поведение
          if (window.WebApp?.openMaxLink) window.WebApp.openMaxLink(deeplink);
          else window.location.href = deeplink;
        }
      } else {
        setState({
          kind: "not_subscribed",
          subscribe_message: d.subscribe_message || "",
          channel_link: d.channel_link || null,
          subscribe_button_text: d.subscribe_button_text || "Подписаться на канал",
          check_button_text: d.check_button_text || "Я подписался",
        });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Ошибка" });
    }
  }, [bot]);

  // Legacy flow (subscribe/magnet) стартуем только если у бота нет своего
  // Mini App. Иначе рендерим кастомный Mini App и SDK-логика не нужна.
  useEffect(() => {
    if (configState.kind !== "legacy") return;
    refresh();
  }, [configState.kind, refresh]);

  // Auto-refresh при возврате в Mini App (юзер вышел в канал → подписался → вернулся).
  // Триггерим re-check на focus/visibilitychange ТОЛЬКО когда юзер на экране «не подписан»,
  // иначе клик «Скачать инструкцию» теряет первое нажатие на refresh.
  useEffect(() => {
    if (state.kind !== "not_subscribed") return;
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh, state.kind]);

  // Пока определяемся, есть у бота свой Mini App или нет — показываем спиннер,
  // чтобы не мигал legacy-экран «Проверяю подписку…» вхолостую.
  if (configState.kind === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f1216", color: "#eaeef3",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        padding: "32px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ textAlign: "center", marginTop: "30vh", opacity: 0.6 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,255,255,.1)", borderTopColor: "#7C5CFF", margin: "0 auto 18px", animation: "r .9s linear infinite" }} />
          <div>Загружаем…</div>
          <style>{"@keyframes r{to{transform:rotate(360deg)}}"}</style>
        </div>
      </div>
    );
  }

  // У бота настроен кастомный Mini App — рендерим через MiniAppRenderer.
  // preview=true когда в URL есть ?preview=1 — открытие из кабинета редактора
  // (без вызова MAX SDK, CTA открывает в новой вкладке).
  if (configState.kind === "custom") {
    const isPreview =
      typeof window !== "undefined" && new URL(window.location.href).searchParams.get("preview") === "1";
    const isDebug =
      typeof window !== "undefined" && new URL(window.location.href).searchParams.get("debug") === "1";
    if (isDebug) return <MaxSdkDebug />;
    return (
      <MiniAppRenderer
        config={configState.config}
        botId={configState.botId}
        botUsername={configState.username}
        channelLink={configState.channelLink}
        preview={isPreview}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1216", color: "#eaeef3",
      fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      padding: "32px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
      {state.kind === "loading" && (
        <div style={{ textAlign: "center", marginTop: "30vh", opacity: 0.6 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(255,255,255,.1)", borderTopColor: "#7C5CFF", margin: "0 auto 18px", animation: "r .9s linear infinite" }} />
          <div>Проверяю подписку…</div>
          <style>{"@keyframes r{to{transform:rotate(360deg)}}"}</style>
        </div>
      )}

      {state.kind === "error" && (
        <div style={{ marginTop: "10vh" }}>
          <div style={{ fontSize: 40, marginBottom: 8, textAlign: "center" }}>😕</div>
          <div style={{ fontWeight: 600, marginBottom: 6, textAlign: "center" }}>Не получилось</div>
          <pre style={{
            opacity: 0.7, fontSize: 11, marginBottom: 16,
            whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "40vh",
            overflow: "auto", padding: 10, background: "rgba(255,255,255,.05)", borderRadius: 8,
            fontFamily: "ui-monospace, SF Mono, monospace",
          }}>{state.message}</pre>
          <button onClick={refresh} style={btnStyle("primary")}>Попробовать ещё раз</button>
        </div>
      )}

      {state.kind === "not_subscribed" && (
        <>
          <div style={{ fontSize: 64, textAlign: "center", marginTop: 18 }}>🔒</div>
          <div style={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.45,
            fontSize: 18,
            fontWeight: 500,
            textAlign: "left",
            padding: "8px 4px",
          }}>
            {state.subscribe_message || "Подпишись на канал, чтобы получить материал."}
          </div>
          {/* Кнопок нет — юзер видит инструкцию подписаться. При возврате в Mini App
              после подписки на канал auto-refresh (focus event) сам подхватит и покажет магнит. */}
        </>
      )}

      {state.kind === "magnet" && (
        <div style={{ textAlign: "center", marginTop: "8vh" }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
            Проверка подписки пройдена
          </div>
          <div style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
            Нажмите кнопку, чтобы получить инструкцию.
          </div>

          {/* Мелким шрифтом — value preview. Приоритет: preview_items (явно настроенный список),
              fallback — парсинг эмодзи-заголовков из delivery_text. */}
          {(() => {
            const items = state.magnet.preview_items
              ? state.magnet.preview_items.split("\n").map((s) => s.trim()).filter(Boolean)
              : extractValueItems(state.magnet.delivery_text || state.magnet.description || "");
            if (items.length === 0) return null;
            return (
              <div style={{
                textAlign: "left",
                opacity: 0.75,
                fontSize: 12,
                lineHeight: 1.6,
                padding: "10px 14px",
                marginBottom: 18,
                background: "rgba(255,255,255,.04)",
                borderRadius: 10,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6, opacity: 0.8 }}>Внутри:</div>
                {items.map((it, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span style={{ color: "#7C5CFF" }}>✓</span>
                    <span>{it}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Тройной удар одновременно: SDK + target="_top" + window.open.
              Хотя бы один способ сработает с первого клика. */}
          <a
            href={state.deeplink}
            target="_top"
            rel="noopener"
            onClick={() => {
              try { window.WebApp?.openMaxLink?.(state.deeplink); } catch { /* ignore */ }
              try { window.WebApp?.openLink?.(state.deeplink); } catch { /* ignore */ }
              try { window.open(state.deeplink, "_top"); } catch { /* ignore */ }
            }}
            style={{ ...btnStyle("primary"), display: "block", textDecoration: "none", textAlign: "center" }}
          >
            📥 Скачать инструкцию
          </a>
        </div>
      )}

      {state.kind === "placeholder" && (
        <div style={{ textAlign: "center", marginTop: "20vh" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>👋</div>
          <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 10 }}>Привет!</div>
          <div style={{ opacity: 0.7, fontSize: 16, lineHeight: 1.5, marginBottom: 24 }}>
            Это сервис для получения лид-магнитов из канала.
            <br /><br />
            Нажми на кнопку под интересным постом в канале, чтобы открыть Mini App с материалом.
          </div>
        </div>
      )}

    </div>
  );
}

/** Извлекает «преимущества» из delivery_text для preview-блока на magnet-странице.
 * Берём строки, которые выглядят как заголовки секций: начинаются с эмодзи и
 * содержат CAPS-текст (типичный паттерн "🎁 ОБРАЗЕЦ ЗАЯВЛЕНИЯ"). */
function extractValueItems(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  // Эмодзи в начале + хотя бы 1 кириллическая прописная буква
  const re = /^([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s+(.+)$/u;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const title = m[2].trim();
    // считаем «заголовком» если содержит хотя бы 2 прописных кириллических буквы подряд
    if (!/[А-ЯЁ]{2,}/.test(title)) continue;
    // не слишком длинные (значит это title, не параграф)
    if (title.length > 80) continue;
    // Приводим к Title Case для красоты (первая буква большая, остальные строчные)
    const pretty = title.charAt(0) + title.slice(1).toLowerCase();
    items.push(pretty);
    if (items.length >= 5) break;  // не больше 5 пунктов чтобы блок был компактный
  }
  return items;
}

function btnStyle(variant: "primary" | "ghost"): React.CSSProperties {
  const base: React.CSSProperties = { padding: "14px 18px", borderRadius: 12, border: 0, fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%" };
  if (variant === "primary") return { ...base, background: "#7C5CFF", color: "#fff" };
  return { ...base, background: "transparent", color: "#7C5CFF", border: "1px solid rgba(124,92,255,.4)" };
}

// ============================================================================
// Debug-страница для инспекции MAX WebApp SDK — /m/<bot>?debug=1
// Открыть в MAX на телефоне, сделать скриншот. Ищем метод типа sendData /
// openBotChat / startBot, который откроет диалог с ботом без экрана «Начать».
// ============================================================================
function MaxSdkDebug() {
  const [info, setInfo] = useState<string>("Загружаю SDK…");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadSdk();
      if (cancelled) return;
      const w = window as unknown as { WebApp?: Record<string, unknown> };
      const app = w.WebApp;
      if (!app) { setInfo("window.WebApp = undefined (SDK не загрузился)"); return; }
      const rows: string[] = [];
      rows.push(`typeof WebApp = ${typeof app}`);
      rows.push("");
      rows.push("=== keys(WebApp) ===");
      for (const k of Object.keys(app)) {
        const v = (app as Record<string, unknown>)[k];
        const t = typeof v;
        if (t === "function") rows.push(`fn  ${k}()`);
        else if (v && typeof v === "object") rows.push(`obj ${k} = ${JSON.stringify(v).slice(0, 120)}`);
        else rows.push(`val ${k} = ${String(v).slice(0, 60)}`);
      }
      rows.push("");
      rows.push("=== version/platform ===");
      rows.push(String((app as Record<string, unknown>).version ?? "no version"));
      rows.push(String((app as Record<string, unknown>).platform ?? "no platform"));
      rows.push("");
      rows.push("=== initDataUnsafe ===");
      rows.push(JSON.stringify((app as Record<string, unknown>).initDataUnsafe ?? null, null, 2).slice(0, 800));
      setInfo(rows.join("\n"));
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <pre style={{
      whiteSpace: "pre-wrap", wordBreak: "break-all",
      padding: 16, fontSize: 12, fontFamily: "ui-monospace, monospace",
      background: "#0f0f14", color: "#e5e5e8", minHeight: "100vh", margin: 0,
    }}>{info}</pre>
  );
}
