// Defaults registry: produces a ready-to-render new block for a given type.
// Every default must satisfy two rules:
//   1) The block renders without crashing (no undefined field the renderer reads).
//   2) The text placeholders make sense in the target vertical
//      (юристы / психологи / коучи / тренеры + бесплатная консультация).

import type {
  AboutData,
  Block,
  BlockByType,
  BlockType,
  BotDeeplinkData,
  ButtonsGridData,
  ChannelCardData,
  CtaConfig,
  CtaData,
  FaqData,
  FaqItem,
  FeatureItem,
  FeaturesData,
  FooterData,
  HeroData,
  ImageData,
  QuoteData,
  TextData,
  VideoData,
} from "./types";

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a URL-safe id for a block. Prefers crypto.randomUUID when available
 * (browser + Node ≥19), falls back to a random+timestamp string otherwise so
 * this module is safe to import from any environment.
 */
export function newBlockId(): string {
  const g: unknown = globalThis;
  if (
    typeof g === "object" &&
    g !== null &&
    "crypto" in g &&
    typeof (g as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID === "function"
  ) {
    return (g as { crypto: { randomUUID: () => string } }).crypto.randomUUID();
  }
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Reusable defaults
// ---------------------------------------------------------------------------

function defaultCta(text = "Записаться на консультацию"): CtaConfig {
  return {
    text,
    destinationType: "bot",
    url: "",
    goalName: "",
  };
}

// ---------------------------------------------------------------------------
// Per-type factories
// ---------------------------------------------------------------------------

function defaultHero(): HeroData {
  return {
    title: "Бесплатная консультация эксперта",
    subtitle:
      "Разберём вашу ситуацию за 20 минут и предложим план решения. Без предоплаты и обязательств.",
    cta: defaultCta("Записаться бесплатно"),
    imageUrl: "",
    imageAlt: "",
    theme: "light",
    align: "left",
  };
}

function defaultText(): TextData {
  return {
    markdown:
      "Опишите здесь **проблему клиента** своими словами. Используйте _курсив_ для важных мыслей и списки для перечислений.\n\n- Один пункт\n- Второй пункт\n- Третий пункт",
    align: "left",
  };
}

function defaultImage(): ImageData {
  return {
    url: "",
    alt: "",
    caption: "",
    width: "wide",
    align: "center",
  };
}

function defaultVideo(): VideoData {
  return {
    url: "",
    provider: "auto",
    caption: "",
    width: "wide",
  };
}

function defaultFeatures(): FeaturesData {
  const items: FeatureItem[] = [
    {
      id: newBlockId(),
      icon: "✓",
      title: "Индивидуальный подход",
      description: "Разбираем именно вашу ситуацию, а не даём шаблонные советы.",
    },
    {
      id: newBlockId(),
      icon: "✓",
      title: "Опыт от 7 лет",
      description: "Более 500 клиентов уже решили свой вопрос вместе с нами.",
    },
    {
      id: newBlockId(),
      icon: "✓",
      title: "Понятная стоимость",
      description: "Фиксируем цену на консультации — никаких скрытых доплат.",
    },
  ];
  return {
    title: "Почему выбирают нас",
    items,
    columns: 1,
  };
}

function defaultQuote(): QuoteData {
  return {
    text: "Пришла с чувством, что запуталась окончательно. За одну встречу разложили всё по полочкам — знаю, что делать дальше.",
    authorName: "Анна",
    authorTitle: "клиент, Москва",
    authorAvatarUrl: "",
  };
}

function defaultFaq(): FaqData {
  const items: FaqItem[] = [
    {
      id: newBlockId(),
      question: "Сколько стоит консультация?",
      answer: "Первая консультация бесплатна и длится до 30 минут.",
    },
    {
      id: newBlockId(),
      question: "Как проходит встреча?",
      answer: "Онлайн, в удобном мессенджере. По итогу вы получаете план действий в письме.",
    },
    {
      id: newBlockId(),
      question: "Что если моя ситуация нестандартная?",
      answer: "Именно поэтому мы всегда начинаем с диагностики — расскажите как есть, разберёмся вместе.",
    },
  ];
  return {
    title: "Частые вопросы",
    items,
  };
}

function defaultAbout(): AboutData {
  return {
    photoUrl: "",
    name: "Ваше имя",
    role: "Эксперт • 7+ лет практики",
    bio:
      "Коротко расскажите о себе: образование, специализация, ключевые результаты. Пишите на языке клиента, без канцелярита.",
    badges: ["500+ клиентов", "МГУ / психфак", "Автор курса", "Спикер конференций"],
  };
}

function defaultCtaBlock(): CtaData {
  return {
    title: "Готовы разобрать вашу ситуацию?",
    subtitle: "Оставьте заявку — свяжемся в течение 15 минут в рабочее время.",
    cta: defaultCta("Записаться на бесплатную консультацию"),
    theme: "violet",
  };
}

function defaultButtonsGrid(): ButtonsGridData {
  return {
    title: "Полезные материалы",
    items: [
      { label: "Гайд по продукту", url: "", emoji: "📘" },
      { label: "Разбор кейса", url: "", emoji: "🔥" },
      { label: "Наш чат", url: "", emoji: "💬" },
      { label: "Отзывы", url: "", emoji: "⭐" },
    ],
  };
}

function defaultChannelCard(): ChannelCardData {
  return {
    title: "Подпишись на канал",
    description: "Разборы, кейсы и апдейты — раз в пару дней, без спама.",
    buttonText: "Подписаться",
  };
}

function defaultBotDeeplink(): BotDeeplinkData {
  return {
    title: "Открыть бота",
    description: "Записаться на консультацию или получить материал в личку.",
    buttonText: "Открыть в чате",
    startCommand: "",
  };
}

function defaultFooter(): FooterData {
  return {
    legalName: "ИП Фамилия И. О.",
    legalId: "ИНН 0000000000",
    email: "hello@example.ru",
    phone: "+7 (000) 000-00-00",
    policyUrl: "",
    policyLabel: "Политика конфиденциальности",
    disclaimer:
      "Информация на сайте не является публичной офертой. Услуги оказываются на основании индивидуального договора.",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Type-safe registry of block factories. Kept internal so the exported
 * `newBlock` returns a properly narrowed union type via the overload below.
 */
const factories: { [K in BlockType]: () => BlockByType[K]["data"] } = {
  hero: defaultHero,
  text: defaultText,
  image: defaultImage,
  video: defaultVideo,
  features: defaultFeatures,
  quote: defaultQuote,
  faq: defaultFaq,
  about: defaultAbout,
  cta: defaultCtaBlock,
  footer: defaultFooter,
  buttons_grid: defaultButtonsGrid,
  channel_card: defaultChannelCard,
  bot_deeplink: defaultBotDeeplink,
};

/**
 * Create a new block of the given type with sensible placeholder content.
 * The returned object is safe to render immediately — no missing fields.
 */
export function newBlock<T extends BlockType>(type: T): BlockByType[T];
export function newBlock(type: BlockType): Block;
export function newBlock(type: BlockType): Block {
  const data = factories[type]();
  // The cast is safe: `type` and `data` are aligned via the `factories` map's
  // conditional-type signature, but TS can't prove the discriminated-union
  // link across the map lookup on its own.
  return { id: newBlockId(), type, data } as Block;
}

/** Convenience: default page skeleton for a brand-new landing. */
export function newLandingBlocks(): Block[] {
  return [
    newBlock("hero"),
    newBlock("features"),
    newBlock("about"),
    newBlock("quote"),
    newBlock("faq"),
    newBlock("cta"),
    newBlock("footer"),
  ];
}
