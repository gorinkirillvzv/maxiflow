// Maxiflow — маркетинговый лендинг в стилистике Manychat: playful,
// цветные секции, скруглённые формы, живые чат-mockup'ы.
import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { ReactNode } from "react";

// ============ Wordmark (без внешнего компонента) ============
function Wordmark() {
  return (
    <Link href="/" className="lp2-wordmark">
      <span className="lp2-logo">
        <span className="lp2-logo-dot" />
      </span>
      <span>Maxiflow</span>
    </Link>
  );
}

// ============ Nav ============
function TopNav() {
  return (
    <nav className="lp2-nav">
      <Wordmark />
      <div className="lp2-nav-links">
        <a href="#how">Как работает</a>
        <a href="#features">Возможности</a>
        <a href="#pricing">Тарифы</a>
        <Link href="/help">База знаний</Link>
      </div>
      <div className="lp2-nav-cta">
        <Link href="/login" className="lp2-btn lp2-btn-ghost">Войти</Link>
        <Link href="/register" className="lp2-btn lp2-btn-primary">
          Попробовать бесплатно
        </Link>
      </div>
    </nav>
  );
}

// ============ Hero ============
function Hero() {
  return (
    <section className="lp2-hero">
      <div className="lp2-hero-bg" />
      <div className="lp2-hero-inner">
        <div className="lp2-hero-text">
          <div className="lp2-eyebrow">
            <span className="lp2-eyebrow-dot" />
            Реклама в Директе → подписки в MAX
          </div>
          <h1 className="lp2-h1">
            Превращайте клики из Директа
            <br />
            в <span className="lp2-h1-mark">подписчиков MAX</span>,
            <br />
            которые покупают.
          </h1>
          <p className="lp2-lede">
            Maxiflow сводит рекламу в Яндекс Директе с подпиской на канал
            в MAX и работой бота. Считает реальную цену подписчика, отдаёт
            лид-магнит и ведёт по воронке — пока вы спите.
          </p>
          <div className="lp2-hero-cta">
            <Link href="/register" className="lp2-btn lp2-btn-primary lp2-btn-lg">
              Попробовать бесплатно
              <Icon name="arrow_r" size={18} />
            </Link>
            <Link href="/help/quick-start" className="lp2-btn lp2-btn-outline lp2-btn-lg">
              Как это работает
            </Link>
          </div>
          <div className="lp2-hero-trust">
            <span><Icon name="check" size={14} stroke="#00B956" strokeWidth={2.6} /> Без карты</span>
            <span><Icon name="check" size={14} stroke="#00B956" strokeWidth={2.6} /> 14 дней бесплатно</span>
            <span><Icon name="check" size={14} stroke="#00B956" strokeWidth={2.6} /> Серверы в РФ</span>
          </div>
        </div>

        <div className="lp2-hero-mock">
          <PhoneMock />
          <FloatingCard offset={{ top: -20, right: -30 }} tint="amber">
            <div className="lp2-floater-eyebrow">Стоимость подписчика</div>
            <div className="lp2-floater-value">
              48 ₽ <span className="lp2-chip lp2-chip-green">−38%</span>
            </div>
          </FloatingCard>
          <FloatingCard offset={{ bottom: 40, left: -50 }} tint="violet">
            <div className="lp2-floater-eyebrow">Новый подписчик</div>
            <div className="lp2-floater-value" style={{ fontSize: 16, fontWeight: 600 }}>
              Мария подписалась на канал
            </div>
            <div className="lp2-floater-sub">Директ · 2 сек назад</div>
          </FloatingCard>
        </div>
      </div>
    </section>
  );
}

function FloatingCard({
  children,
  offset,
  tint,
}: {
  children: ReactNode;
  offset: { top?: number; bottom?: number; left?: number; right?: number };
  tint: "amber" | "violet";
}) {
  return (
    <div
      className={`lp2-floater lp2-floater-${tint}`}
      style={{
        top: offset.top,
        bottom: offset.bottom,
        left: offset.left,
        right: offset.right,
      }}
    >
      {children}
    </div>
  );
}

// ============ Phone-mock: MAX-канал с сообщением от бота ============
function PhoneMock() {
  return (
    <div className="lp2-phone">
      <div className="lp2-phone-notch" />
      <div className="lp2-phone-screen">
        <div className="lp2-phone-head">
          <div className="lp2-phone-avatar">
            <Icon name="bot" size={20} stroke="#5B47FB" strokeWidth={1.8} />
          </div>
          <div>
            <div className="lp2-phone-name">Юрист. Банкротство</div>
            <div className="lp2-phone-sub">бот · онлайн</div>
          </div>
        </div>
        <div className="lp2-chat">
          <ChatBubble side="in">
            Спасибо, что подписались! Держите обещанный чек-лист «Как списать долги через МФЦ» — файл ниже.
          </ChatBubble>
          <ChatBubble side="in" attach>
            checklist-mfc.pdf
          </ChatBubble>
          <ChatBubble side="out">Спасибо! А что делать, если есть залог?</ChatBubble>
          <ChatBubble side="in">
            Расскажу подробно. Для начала — сколько всего долгов? Я подберу схему.
          </ChatBubble>
          <div className="lp2-typing"><span /><span /><span /></div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  children,
  side,
  attach = false,
}: {
  children: ReactNode;
  side: "in" | "out";
  attach?: boolean;
}) {
  return (
    <div className={`lp2-bubble lp2-bubble-${side}`}>
      {attach && <span className="lp2-bubble-file"><Icon name="file" size={14} stroke="#5B47FB" strokeWidth={1.8} /></span>}
      {children}
    </div>
  );
}

// ============ Trust numbers ============
function TrustBar() {
  const stats = [
    { value: "3.4×", label: "рост ROI на подписчика" },
    { value: "48 ₽", label: "средняя цена подписчика в MAX" },
    { value: "8 мин", label: "от регистрации до первой рекламы" },
  ];
  return (
    <section className="lp2-trust">
      <div className="lp2-trust-inner">
        {stats.map((s) => (
          <div key={s.label} className="lp2-trust-item">
            <div className="lp2-trust-value">{s.value}</div>
            <div className="lp2-trust-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ How it works — 3 шага ============
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Подключаете MAX и Директ",
      desc: "Один клик по OAuth, вставляете токен бота — Maxiflow сам создаёт цели в Метрике.",
      icon: "bolt" as const,
      tint: "violet" as const,
    },
    {
      n: "02",
      title: "Отдаёте магнит за подписку",
      desc: "Клиент подписывается на канал, бот присылает файл/видео/шаблон. Всё автоматически.",
      icon: "magnet" as const,
      tint: "amber" as const,
    },
    {
      n: "03",
      title: "Считаете реальную цену",
      desc: "Yclid из клика бьётся с подпиской, офлайн-конверсии улетают в Метрику. Директ учится.",
      icon: "trend_up" as const,
      tint: "coral" as const,
    },
  ];
  return (
    <section className="lp2-section" id="how">
      <SectionHeader
        eyebrow="Как это работает"
        title="Три шага до первого подписчика из рекламы"
        subtitle="Никаких таблиц, экспорта и склеек в Excel. Maxiflow сам связывает клик, подписку и покупку."
      />
      <div className="lp2-steps">
        {steps.map((s) => (
          <div key={s.n} className={`lp2-step lp2-step-${s.tint}`}>
            <div className="lp2-step-head">
              <span className="lp2-step-num">{s.n}</span>
              <span className="lp2-step-icon">
                <Icon name={s.icon} size={22} stroke="currentColor" strokeWidth={1.8} />
              </span>
            </div>
            <h3 className="lp2-step-title">{s.title}</h3>
            <p className="lp2-step-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ Features (alternating rows) ============
function Features() {
  return (
    <section className="lp2-section lp2-features" id="features">
      <SectionHeader
        eyebrow="Что внутри"
        title="Один кабинет вместо десяти вкладок"
        subtitle="Мы собрали все инструменты для роста MAX-канала на рекламных бюджетах — в одном месте."
      />

      <FeatureRow
        pill="Атрибуция"
        title="Считаем реальную цену подписчика"
        body="Каждый клик из Директа сохраняет yclid и campaign_id. Когда человек подписывается на канал — Maxiflow автоматически сопоставляет клик с подпиской и передаёт офлайн-конверсию в Метрику. Директ учится приводить именно тех, кто платит."
        bullets={[
          "yclid + campaign_id + vk_click_id — сразу",
          "Офлайн-цели в Метрике по каждой подписке",
          "Отчёты по кампаниям с реальным CPA",
        ]}
        mockup={<AttributionMock />}
      />
      <FeatureRow
        reverse
        pill="Магниты"
        title="Раздавайте магнит за подписку"
        body="Загружаете файл, ссылку или видео — бот присылает его новому подписчику сразу после клика по каналу. Внутри канала — Mini App, чтобы человек забрал магнит в один жест."
        bullets={[
          "PDF, картинка, ссылка, видео",
          "Mini App внутри MAX",
          "Приветственное сообщение + первый шаг воронки",
        ]}
        mockup={<MagnetMock />}
      />
      <FeatureRow
        pill="Воронки"
        title="Ведёте по воронке, пока вы спите"
        body="Настраиваете сценарий сообщений: приветствие → чекап потребности → предложение → напоминание. Бот сам ведёт диалог, а вы видите каждый ответ в реальном времени."
        bullets={[
          "Ветки диалога и условия",
          "Ответы клиента прилетают в кабинет",
          "Живой чат-перехват в один клик",
        ]}
        mockup={<FunnelMock />}
      />
    </section>
  );
}

function FeatureRow({
  pill,
  title,
  body,
  bullets,
  mockup,
  reverse = false,
}: {
  pill: string;
  title: string;
  body: string;
  bullets: string[];
  mockup: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`lp2-feat ${reverse ? "lp2-feat-rev" : ""}`}>
      <div className="lp2-feat-text">
        <span className="lp2-pill">{pill}</span>
        <h3 className="lp2-feat-title">{title}</h3>
        <p className="lp2-feat-body">{body}</p>
        <ul className="lp2-feat-bullets">
          {bullets.map((b) => (
            <li key={b}>
              <Icon name="check" size={16} stroke="#5B47FB" strokeWidth={2.4} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="lp2-feat-mock">{mockup}</div>
    </div>
  );
}

// ============ Feature mockups ============
function AttributionMock() {
  const rows = [
    { camp: "Кампания 710807682", clicks: 143, subs: 68, cpa: "42 ₽" },
    { camp: "Кампания 710770443", clicks: 92, subs: 27, cpa: "58 ₽" },
    { camp: "Кампания 710214614", clicks: 61, subs: 23, cpa: "51 ₽" },
  ];
  return (
    <div className="lp2-panel">
      <div className="lp2-panel-head">
        <div>
          <div className="lp2-panel-eyebrow">Директ · 7 дней</div>
          <div className="lp2-panel-title">Атрибуция кампаний</div>
        </div>
        <span className="lp2-chip lp2-chip-green"><Icon name="trend_up" size={12} strokeWidth={2.4} /> +34%</span>
      </div>
      <table className="lp2-table">
        <thead>
          <tr>
            <th>Кампания</th>
            <th>Клики</th>
            <th>Подписки</th>
            <th>Цена</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.camp}>
              <td>{r.camp}</td>
              <td>{r.clicks}</td>
              <td><b>{r.subs}</b></td>
              <td className="lp2-cell-cpa">{r.cpa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MagnetMock() {
  return (
    <div className="lp2-panel lp2-panel-magnet">
      <div className="lp2-magnet-card">
        <div className="lp2-magnet-icon"><Icon name="magnet" size={26} stroke="#fff" strokeWidth={1.8} /></div>
        <div>
          <div className="lp2-magnet-title">Чек-лист: как списать долги за 6 месяцев</div>
          <div className="lp2-magnet-sub">PDF, 12 стр. · 2 341 скачивание</div>
        </div>
      </div>
      <div className="lp2-magnet-stats">
        <div>
          <div className="lp2-stat-value">2 341</div>
          <div className="lp2-stat-label">выдано</div>
        </div>
        <div>
          <div className="lp2-stat-value">78%</div>
          <div className="lp2-stat-label">открывают</div>
        </div>
        <div>
          <div className="lp2-stat-value">21%</div>
          <div className="lp2-stat-label">пишут в бота</div>
        </div>
      </div>
    </div>
  );
}

function FunnelMock() {
  const nodes = [
    { label: "Приветствие", icon: "smile" as const },
    { label: "Проверка подписки", icon: "check" as const },
    { label: "Магнит", icon: "magnet" as const },
    { label: "Квалификация", icon: "users" as const },
    { label: "Оффер", icon: "bolt" as const },
  ];
  return (
    <div className="lp2-panel">
      <div className="lp2-panel-head">
        <div>
          <div className="lp2-panel-eyebrow">Воронка</div>
          <div className="lp2-panel-title">Банкротство через МФЦ</div>
        </div>
        <span className="lp2-chip lp2-chip-violet">активна</span>
      </div>
      <div className="lp2-funnel">
        {nodes.map((n, i) => (
          <div key={n.label} className="lp2-funnel-node">
            <span className="lp2-funnel-icon">
              <Icon name={n.icon} size={16} stroke="#5B47FB" strokeWidth={2} />
            </span>
            <span>{n.label}</span>
            {i < nodes.length - 1 && <span className="lp2-funnel-arrow"><Icon name="arrow_r" size={14} stroke="#c7c3b6" strokeWidth={2} /></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Integrations ============
function Integrations() {
  const items = [
    { name: "MAX", icon: "max" as const, color: "#2E7DFF" },
    { name: "Яндекс Директ", icon: "yandex" as const, color: "#FFCC00" },
    { name: "Метрика", icon: "analytics" as const, color: "#FF3B30" },
    { name: "VK Реклама", icon: "users" as const, color: "#0077FF" },
    { name: "T-Bank Pay", icon: "ruble" as const, color: "#FFDD2D" },
  ];
  return (
    <section className="lp2-integrations">
      <div className="lp2-integrations-inner">
        <span className="lp2-eyebrow lp2-eyebrow-center">Интеграции</span>
        <h3 className="lp2-int-title">Работаем с тем, чем вы уже пользуетесь</h3>
        <div className="lp2-int-logos">
          {items.map((i) => (
            <div key={i.name} className="lp2-int-logo">
              <span className="lp2-int-icon" style={{ background: i.color }}>
                <Icon name={i.icon} size={22} stroke="#fff" strokeWidth={1.8} />
              </span>
              <span>{i.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ Testimonial ============
function Testimonial() {
  return (
    <section className="lp2-testi">
      <div className="lp2-testi-inner">
        <div className="lp2-testi-card">
          <div className="lp2-testi-quote">
            «До Maxiflow подписчик из Директа обходился в 130 ₽, а половина
            терялась между кликом и каналом. Через две недели после подключения
            стоимость упала до 48 ₽, а конверсия в первую покупку выросла втрое».
          </div>
          <div className="lp2-testi-author">
            <div className="lp2-testi-avatar">К</div>
            <div>
              <div className="lp2-testi-name">Кирилл Горин</div>
              <div className="lp2-testi-role">Юрист по банкротству, ponulam.ru</div>
            </div>
          </div>
        </div>
        <div className="lp2-testi-metric">
          <div className="lp2-testi-num">−63%</div>
          <div className="lp2-testi-metric-label">стоимость подписчика</div>
          <div className="lp2-testi-metric-sub">за первые 2 недели</div>
        </div>
      </div>
    </section>
  );
}

// ============ Pricing preview ============
function Pricing() {
  const plans = [
    {
      name: "Старт",
      price: "1 990 ₽",
      period: "/мес",
      desc: "Для соло-практиков и небольших каналов",
      features: ["До 1 000 подписчиков", "1 бот, 3 магнита", "Атрибуция Директа"],
      cta: "Попробовать",
      accent: false,
    },
    {
      name: "Бизнес",
      price: "4 990 ₽",
      period: "/мес",
      desc: "Для агентств и растущих проектов",
      features: ["До 10 000 подписчиков", "5 ботов, безлимит магнитов", "VK Реклама, A/B", "Приоритетная поддержка"],
      cta: "Взять бизнес",
      accent: true,
    },
    {
      name: "Масштаб",
      price: "14 900 ₽",
      period: "/мес",
      desc: "Когда пора считать миллионы",
      features: ["От 50 000 подписчиков", "SLA · выделенный менеджер", "White-label по запросу"],
      cta: "Обсудить",
      accent: false,
    },
  ];
  return (
    <section className="lp2-section" id="pricing">
      <SectionHeader
        eyebrow="Тарифы"
        title="Платите за результат, а не за фичи"
        subtitle="Все тарифы — с полной атрибуцией, магнитами и живым чатом. Различаются только объёмами."
      />
      <div className="lp2-plans">
        {plans.map((p) => (
          <div key={p.name} className={`lp2-plan ${p.accent ? "lp2-plan-accent" : ""}`}>
            {p.accent && <div className="lp2-plan-badge">Популярный</div>}
            <div className="lp2-plan-name">{p.name}</div>
            <div className="lp2-plan-price">
              {p.price}<span>{p.period}</span>
            </div>
            <div className="lp2-plan-desc">{p.desc}</div>
            <ul className="lp2-plan-feats">
              {p.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={16} stroke={p.accent ? "#fff" : "#5B47FB"} strokeWidth={2.4} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className={`lp2-btn lp2-btn-lg ${p.accent ? "lp2-btn-white" : "lp2-btn-primary"}`}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ Big CTA ============
function BigCTA() {
  return (
    <section className="lp2-bigcta">
      <div className="lp2-bigcta-inner">
        <div className="lp2-bigcta-glow" />
        <h2 className="lp2-bigcta-h">
          Первая подписка из Директа —<br />уже сегодня вечером.
        </h2>
        <p className="lp2-bigcta-p">
          Регистрация занимает 30 секунд. 14 дней бесплатно, без карты.
        </p>
        <Link href="/register" className="lp2-btn lp2-btn-white lp2-btn-lg">
          Подключить канал
          <Icon name="rocket" size={18} />
        </Link>
      </div>
    </section>
  );
}

// ============ Footer ============
function Footer() {
  return (
    <footer className="lp2-footer">
      <div className="lp2-footer-inner">
        <div className="lp2-footer-col lp2-footer-brand">
          <Wordmark />
          <p>Реклама в Директе. Подписки в MAX. Один кабинет.</p>
          <div className="lp2-footer-legal">© Maxiflow, 2026</div>
        </div>
        <div className="lp2-footer-col">
          <div className="lp2-footer-h">Продукт</div>
          <a href="#how">Как работает</a>
          <a href="#features">Возможности</a>
          <a href="#pricing">Тарифы</a>
        </div>
        <div className="lp2-footer-col">
          <div className="lp2-footer-h">Помощь</div>
          <Link href="/help">База знаний</Link>
          <Link href="/help/quick-start">Быстрый старт</Link>
          <Link href="/help/billing">Оплата</Link>
        </div>
        <div className="lp2-footer-col">
          <div className="lp2-footer-h">Аккаунт</div>
          <Link href="/login">Войти</Link>
          <Link href="/register">Регистрация</Link>
        </div>
      </div>
    </footer>
  );
}

// ============ SectionHeader ============
function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="lp2-secthead">
      <span className="lp2-eyebrow lp2-eyebrow-center">{eyebrow}</span>
      <h2 className="lp2-h2">{title}</h2>
      <p className="lp2-secthead-sub">{subtitle}</p>
    </div>
  );
}

// ============ Page ============
export default function LandingPage() {
  return (
    <div className="lp2">
      <TopNav />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <Features />
      <Integrations />
      <Testimonial />
      <Pricing />
      <BigCTA />
      <Footer />
    </div>
  );
}
