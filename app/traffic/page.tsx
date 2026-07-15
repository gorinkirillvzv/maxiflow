"use client";
// Maxiflow — мастер создания ссылки для рекламы.
// 3 шага: способ доставки → цель → готовый артефакт.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";

type Bot = { id: string; max_bot_username: string; channel_title: string | null; platform?: "max" | "telegram" };
type Funnel = { id: string; name: string; trigger: string | null; is_default: boolean };

type Delivery = "snippet" | "redirect" | "landing";
type Destination = "bot" | "channel_post";
type AdSource = "direct" | "vk" | "both";

const AD_SOURCES: { id: AdSource; label: string; hint: string }[] = [
  { id: "direct", label: "Яндекс.Директ", hint: "?yclid={yclid}&c={campaign_id}" },
  { id: "vk",     label: "VK Реклама",    hint: "?rb_clickid={{clickid}}" },
  { id: "both",   label: "Универсальная", hint: "?yclid={yclid}&c={campaign_id}&rb_clickid={{clickid}}" },
];

function adQuery(src: AdSource): string {
  if (src === "direct") return "yclid={yclid}&c={campaign_id}";
  if (src === "vk")     return "rb_clickid={{clickid}}";
  return "yclid={yclid}&c={campaign_id}&rb_clickid={{clickid}}";
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://maxiflow.ru";

const DELIVERY_OPTIONS: { id: Delivery; emoji: string; title: string; desc: string; bestFor: string }[] = [
  {
    id: "snippet",
    emoji: "🧩",
    title: "JS-сниппет на свой лендинг",
    desc: "Вставляешь <script> на свою страницу, любая кнопка с атрибутом data-mfx-cta ведёт в бота с yclid/campaign.",
    bestFor: "Когда у тебя уже есть свой продающий лендинг с Метрикой",
  },
  {
    id: "redirect",
    emoji: "⚡",
    title: "Невидимый редирект",
    desc: "Чистая страница-переходник: грузит твою Метрику и перебрасывает в бота за 450 мс. Юзер ничего не видит.",
    bestFor: "Когда лендинг не нужен — клиент сразу идёт в бота",
  },
  {
    id: "landing",
    emoji: "🪂",
    title: "Мини-лендинг Maxiflow",
    desc: "Готовая брендированная страница с заголовком, картинкой и кнопкой. Метрика подключается автоматически.",
    bestFor: "Когда лендинга нет и не хочется его делать",
  },
];

const DESTINATION_OPTIONS: { id: Destination; emoji: string; title: string; desc: string }[] = [
  {
    id: "bot",
    emoji: "🤖",
    title: "Сразу в бот",
    desc: "Подписчик попадает в бота, получает магнит. yclid пробрасывается → конверсии Метрики сматчатся.",
  },
  {
    id: "channel_post",
    emoji: "📢",
    title: "На пост в канале",
    desc: "Подписчик читает контент-пост → жмёт кнопку под постом → бот. yclid сохраняется через куку Maxiflow (нужно настроить «Пост для рекламы» в /channels и поставить кнопку с URL /g/<bot>).",
  },
];

export default function TrafficPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);

  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [trigger, setTrigger] = useState("");

  // для destination=post — URL поста (только для landing-варианта, потому что snippet/redirect
  // концептуально не имеют экрана с кнопкой)
  const [postUrl, setPostUrl] = useState("");

  // источник рекламы — определяет какие плейсхолдеры подставлять в готовый URL
  const [adSource, setAdSource] = useState<AdSource>("direct");

  useEffect(() => {
    fetch("/api/bots").then((r) => r.json()).then(async (d) => {
      const list: Bot[] = d.bots ?? [];
      setBots(list);
      const { pickActiveBot } = await import("@/lib/active-bot");
      const pick = pickActiveBot(list);
      if (pick) setBotId(pick.id);
    });
  }, []);

  useEffect(() => {
    if (!botId) return;
    fetch(`/api/funnel?bot_id=${botId}`).then((r) => r.json()).then((d) => setFunnels(d.funnels ?? []));
  }, [botId]);

  const bot = bots.find((b) => b.id === botId);

  function reset() {
    setStep(1); setDelivery(null); setDestination(null); setPostUrl("");
  }

  function next() {
    if (step === 1 && delivery) setStep(2);
    else if (step === 2 && destination) setStep(3);
  }
  function back() {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  return (
    <Shell active="traffic" title="Новая рекламная ссылка" breadcrumbs={["Кампании", "Трафик"]}>
      <div style={{ padding: "20px 24px", maxWidth: 760, margin: "0 auto" }}>

        {/* контекст: бот + воронка */}
        <div className="kk-card kk-pad-4" style={{ marginBottom: 18 }}>
          <div className="kk-row kk-gap-3" style={{ flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="kk-label">Бот</label>
              <select className="kk-input" style={{ width: "100%", marginTop: 4 }}
                value={botId} onChange={(e) => { setBotId(e.target.value); import("@/lib/active-bot").then((m) => m.writeActiveBotId(e.target.value)); }}>
                {bots.length === 0 && <option>— нет ботов —</option>}
                {bots.map((b) => <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="kk-label">Воронка (триггер)</label>
              <select className="kk-input" style={{ width: "100%", marginTop: 4 }}
                value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                <option value="">— по умолчанию —</option>
                {funnels.filter((f) => f.trigger).map((f) => (
                  <option key={f.id} value={f.trigger ?? ""}>{f.name} ({f.trigger})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Источник рекламы — определяет какие плейсхолдеры подставлять в URL */}
          <div style={{ marginTop: 12 }}>
            <label className="kk-label">Источник рекламы</label>
            <div className="kk-row kk-gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
              {AD_SOURCES.map((s) => {
                const active = adSource === s.id;
                return (
                  <button key={s.id} onClick={() => setAdSource(s.id)}
                    className="kk-btn kk-btn-sm"
                    style={{
                      background: active ? "var(--brand-violet-12)" : "var(--n-0)",
                      border: active ? "1.5px solid var(--brand-violet)" : "1px solid var(--n-200)",
                      color: active ? "var(--brand-violet)" : "var(--n-700)",
                      fontWeight: active ? 600 : 500,
                      padding: "4px 10px",
                    }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="kk-xs kk-muted" style={{ marginTop: 6, fontFamily: "var(--font-mono)" }}>
              плейсхолдеры: <code>{AD_SOURCES.find((s) => s.id === adSource)?.hint}</code>
            </div>
          </div>
        </div>

        <Stepper step={step} />

        {!bot ? (
          <div className="kk-card kk-pad-5 kk-muted kk-sm" style={{ textAlign: "center" }}>
            Сначала подключи бота в разделе «Каналы».
          </div>
        ) : step === 1 ? (
          <Step1 selected={delivery} onSelect={setDelivery} />
        ) : step === 2 ? (
          <Step2 delivery={delivery!} selected={destination} onSelect={setDestination}
            postUrl={postUrl} onPostUrl={setPostUrl} />
        ) : (
          <Step3 bot={bot} trigger={trigger} delivery={delivery!} destination={destination!}
            postUrl={postUrl} adSource={adSource} onReset={reset} />
        )}

        {step < 3 && bot && (
          <div className="kk-row" style={{ justifyContent: "space-between", marginTop: 18 }}>
            <button className="kk-btn kk-btn-ghost"
              onClick={back} disabled={step === 1}
              style={{ opacity: step === 1 ? 0.4 : 1 }}>← Назад</button>
            <button className="kk-btn kk-btn-accent" onClick={next}
              disabled={(step === 1 && !delivery) || (step === 2 && !destination)}>
              Дальше →
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ───────────────── Stepper ─────────────────

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Способ доставки", "Куда ведём", "Готовая ссылка"];
  return (
    <div className="kk-row" style={{ marginBottom: 22, gap: 12, alignItems: "center" }}>
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const isActive = step === n;
        const isDone = step > n;
        return (
          <div key={i} className="kk-row kk-gap-2" style={{ flex: 1, alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              display: "grid", placeItems: "center",
              background: isDone ? "var(--success)" : isActive ? "var(--brand-violet)" : "var(--n-100)",
              color: isDone || isActive ? "#fff" : "var(--n-500)",
              fontWeight: 700, fontSize: 13,
            }}>
              {isDone ? <Icon name="check" size={14} strokeWidth={2.6} /> : n}
            </div>
            <div className="kk-sm" style={{
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--brand-ink)" : "var(--n-500)",
              whiteSpace: "nowrap",
            }}>{label}</div>
            {i < items.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: isDone ? "var(--success)" : "var(--n-100)",
                marginLeft: 4, borderRadius: 99, minWidth: 14,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────── Step 1 ─────────────────

function Step1({ selected, onSelect }: { selected: Delivery | null; onSelect: (d: Delivery) => void }) {
  return (
    <div className="kk-col kk-gap-3">
      <div className="kk-h4">Как доставляем подписчика в бота?</div>
      {DELIVERY_OPTIONS.map((opt) => (
        <button key={opt.id} onClick={() => onSelect(opt.id)}
          className="kk-card kk-pad-4" style={{
            cursor: "pointer", textAlign: "left",
            border: selected === opt.id ? "2px solid var(--brand-violet)" : "1px solid var(--n-100)",
            background: selected === opt.id ? "var(--brand-violet-12)" : "var(--n-0)",
          }}>
          <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start" }}>
            <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{opt.title}</div>
              <div className="kk-sm" style={{ marginTop: 4, lineHeight: 1.5 }}>{opt.desc}</div>
              <div className="kk-xs kk-muted" style={{ marginTop: 8 }}>
                <b>Когда выбирать:</b> {opt.bestFor}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ───────────────── Step 2 ─────────────────

function Step2({ delivery, selected, onSelect, postUrl, onPostUrl }: {
  delivery: Delivery;
  selected: Destination | null;
  onSelect: (d: Destination) => void;
  postUrl: string;
  onPostUrl: (s: string) => void;
}) {
  return (
    <div className="kk-col kk-gap-3">
      <div className="kk-h4">Куда ведёт CTA?</div>
      {DESTINATION_OPTIONS.map((opt) => (
        <button key={opt.id} onClick={() => onSelect(opt.id)}
          className="kk-card kk-pad-4" style={{
            cursor: "pointer", textAlign: "left",
            border: selected === opt.id ? "2px solid var(--brand-violet)" : "1px solid var(--n-100)",
            background: selected === opt.id ? "var(--brand-violet-12)" : "var(--n-0)",
          }}>
          <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start" }}>
            <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{opt.title}</div>
              <div className="kk-sm" style={{ marginTop: 4, lineHeight: 1.5 }}>{opt.desc}</div>
            </div>
          </div>
        </button>
      ))}

      {selected === "channel_post" && (
        <div className="kk-card kk-pad-4" style={{ background: "var(--brand-amber-12)" }}>
          <label className="kk-label">URL поста в канале</label>
          <input className="kk-input" style={{ width: "100%", marginTop: 6 }}
            value={postUrl} onChange={(e) => onPostUrl(e.target.value)}
            placeholder="https://max.ru/<канал>/<post_id>" />
          <div className="kk-xs" style={{ marginTop: 6, lineHeight: 1.55 }}>
            URL поста запишется прямо в рекламную ссылку. <code>/r/</code> на лету
            редиректнет юзера на этот пост (предварительно стрельнув визитом в Метрику с yclid
            и поставив куку для атрибуции). Если поле оставить пустым — будет использован дефолтный
            «Пост для рекламы» из <a href="/channels" style={{ color: "var(--brand-violet)", fontWeight: 600 }}>/channels</a>.
          </div>
        </div>
      )}

      {selected === "bot" && (
        <div className="kk-card kk-pad-3 kk-xs" style={{ background: "var(--brand-amber-12)", lineHeight: 1.55 }}>
          ⚠️ <b>Требование Яндекс.Директа.</b> Если реклама ведёт <b>прямо в бота</b> (минуя
          лендинг с реквизитами), в <b>описание бота</b> должны быть добавлены реквизиты
          рекламодателя — иначе модерация не пропустит объявление:
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>ИП или ООО (полное наименование)</li>
            <li>контактный телефон</li>
            <li>юридический адрес</li>
            <li>ИНН</li>
          </ul>
          Если реквизитов нет — выбирай вариант «JS-сниппет на свой лендинг» или «Мини-лендинг»
          на шаге 1 и размещай их там.
        </div>
      )}
    </div>
  );
}

// ───────────────── Step 3 ─────────────────

function Step3({ bot, trigger, delivery, destination, postUrl, adSource, onReset }: {
  bot: Bot;
  trigger: string;
  delivery: Delivery;
  destination: Destination;
  postUrl: string;
  adSource: AdSource;
  onReset: () => void;
}) {
  const artifact = useMemo(() => buildArtifact({ bot, trigger, delivery, destination, postUrl, adSource }), [bot, trigger, delivery, destination, postUrl, adSource]);

  return (
    <div className="kk-col kk-gap-3">
      <div className="kk-card kk-pad-5" style={{ background: "var(--success-12)" }}>
        <div className="kk-row kk-gap-3" style={{ marginBottom: 6 }}>
          <Icon name="check" size={22} stroke="var(--success)" strokeWidth={2.6} />
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0A7A3C" }}>Ссылка готова</div>
        </div>
        <div className="kk-sm" style={{ lineHeight: 1.55 }}>{artifact.summary}</div>
      </div>

      <div className="kk-card kk-pad-5">
        <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div className="kk-label" style={{ margin: 0 }}>{artifact.label}</div>
          <button className="kk-btn kk-btn-ghost kk-btn-sm"
            onClick={() => navigator.clipboard?.writeText(artifact.code)}>
            <Icon name="copy" size={12} /> Копировать
          </button>
        </div>
        <pre style={{
          margin: 0, fontFamily: "var(--font-mono)", fontSize: 12,
          background: "var(--n-50)", padding: 12, borderRadius: 10,
          whiteSpace: artifact.multiline ? "pre" : "pre-wrap",
          wordBreak: artifact.multiline ? "normal" : "break-all",
          maxHeight: artifact.multiline ? 280 : "auto", overflowY: "auto",
        }}>{artifact.code}</pre>

        {artifact.instructions && (
          <div className="kk-sm kk-muted" style={{ marginTop: 12, lineHeight: 1.55 }}>
            {artifact.instructions}
          </div>
        )}
      </div>

      {delivery === "landing" && (
        <div className="kk-card kk-pad-4" style={{ background: "var(--brand-amber-12)" }}>
          <div className="kk-sm" style={{ marginBottom: 8, fontWeight: 600 }}>
            Создание мини-лендинга — на отдельной странице:
          </div>
          <Link href="/landings" className="kk-btn kk-btn-accent">
            Открыть «Лендинги» →
          </Link>
        </div>
      )}

      <div className="kk-row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <button className="kk-btn kk-btn-ghost" onClick={onReset}>← Сделать другую</button>
        <Link href="/dashboard" className="kk-btn kk-btn-outline">К дашборду →</Link>
      </div>
    </div>
  );
}

// ───────────────── helpers ─────────────────

type ArtifactResult = {
  label: string;
  code: string;
  summary: string;
  instructions?: React.ReactNode;
  multiline?: boolean;
};

function buildArtifact({ bot, trigger, delivery, destination, postUrl, adSource }: {
  bot: Bot; trigger: string; delivery: Delivery; destination: Destination; postUrl: string; adSource: AdSource;
}): ArtifactResult {
  const tParam = trigger ? `&trigger=${trigger}` : "";
  const adQS = adQuery(adSource);
  const srcLabel = adSource === "direct" ? "Яндекс.Директа"
    : adSource === "vk" ? "VK Рекламы"
    : "Директа и VK Рекламы";

  if (delivery === "snippet") {
    const src = `${APP_URL}/lp/script.js?bot=${bot.max_bot_username}${trigger ? `&trigger=${trigger}` : ""}`;
    return {
      label: "Сниппет (вставить в HTML своего лендинга)",
      summary: `Вставь сниппет на свой лендинг. Любая кнопка с атрибутом data-mfx-cta станет ссылкой в бота. Метрика на твоём лендинге зафиксирует визит — конверсии ${srcLabel} сматчатся.`,
      multiline: true,
      code: `<!-- Maxiflow LP snippet -->
<script src="${src}" async></script>

<!-- Любая кнопка с этим атрибутом станет CTA в бота: -->
<button data-mfx-cta>Получить материал</button>
<!-- или ссылка: -->
<a data-mfx-cta href="#">Получить материал</a>`,
      instructions: (
        <>
          В объявлении ставь ссылку <b>на свою страницу с этим сниппетом</b>{" "}
          с плейсхолдерами: <code>https://твой-лендинг.ru/page?{adQS}</code>.
          Сниппет сам подхватит параметры из URL и пробросит в бота.
        </>
      ),
    };
  }

  if (delivery === "redirect") {
    const pParam = destination === "channel_post" && postUrl.trim()
      ? `&post=${encodeURIComponent(postUrl.trim())}`
      : "";
    const url = `${APP_URL}/r/${bot.max_bot_username}?${adQS}${tParam}${pParam}`;
    const target = destination === "channel_post"
      ? (postUrl.trim() ? "указанный пост в канале" : "дефолтный пост из /channels (или прямо в бота если не задан)")
      : "чат с ботом";
    return {
      label: "URL для рекламного объявления",
      summary: `Невидимый редирект: регистрируется визит в Метрике с идентификаторами клика ${srcLabel} → редирект на ${target}.`,
      code: url,
      instructions: (
        <>
          Эту ссылку целиком вставляешь в URL объявления — макросы{" "}
          <code>{adSource === "vk" ? "{{clickid}}" : adSource === "direct" ? "{yclid}/{campaign_id}" : "{yclid}/{campaign_id}/{{clickid}}"}</code>{" "}
          заполнит рекламная система автоматически.
          {destination === "channel_post" && (
            <>
              {" "}URL поста зашит прямо в рекламную ссылку — на каждую кампанию можно сгенерить свою ссылку с разным постом.
            </>
          )}
        </>
      ),
    };
  }

  // delivery === "landing"
  if (destination === "channel_post" && postUrl.trim()) {
    return {
      label: "Что делать",
      summary: "Создашь мини-лендинг в /landings: cell «Куда ведёт кнопка» = «На пост в канале», вставишь URL поста.",
      code: `1. Открой /landings → Создать
2. Заполни заголовок, картинку, текст кнопки
3. В поле «Куда ведёт кнопка» выбери: «На пост в канале»
4. Вставь URL: ${postUrl}
5. Скопируй с карточки готовую рекламную ссылку`,
      instructions: <>В этой связке yclid сохраняется через куку Maxiflow: лендинг → пост → кнопка под постом (URL <code>/g/&lt;bot&gt;</code>) → бот. Главное — кнопка под постом должна вести через <code>/g/</code>, иначе yclid потеряется на финальном шаге.</>,
    };
  }

  return {
    label: "Что делать",
    summary: "Мини-лендинг создаётся через отдельный CRUD: задаёшь заголовок, картинку, описание, текст кнопки, цель Метрики. Maxiflow сгенерирует ссылку /l/<slug>.",
    code: `1. Открой /landings → Создать
2. Заполни заголовок, описание, картинку
3. Выбери воронку${trigger ? ` (триггер: ${trigger})` : ""}
4. Сохрани и скопируй ссылку с карточки лендинга
5. Вставь в URL объявления Директа`,
  };
}
