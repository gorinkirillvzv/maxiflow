// Type registry for landing page block system.
// Each block is a discriminated union member keyed by `type`.
// Adding a new block type: add it here, add a default in ./defaults.ts,
// then create components/landing-blocks/<type>/{Editor,Renderer}.tsx.

// ---------------------------------------------------------------------------
// Block type discriminator
// ---------------------------------------------------------------------------

export type BlockType =
  | "hero"
  | "text"
  | "image"
  | "video"
  | "features"
  | "quote"
  | "faq"
  | "about"
  | "cta"
  | "footer"
  | "buttons_grid"
  | "channel_card"
  | "bot_deeplink";

export const BLOCK_TYPES: readonly BlockType[] = [
  "hero",
  "text",
  "image",
  "video",
  "features",
  "quote",
  "faq",
  "about",
  "cta",
  "footer",
  "buttons_grid",
  "channel_card",
  "bot_deeplink",
] as const;

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/** How wide an image/video sits inside the landing container. */
export type MediaWidth = "narrow" | "wide" | "full";

/** Text alignment for headings/paragraphs inside a block. */
export type TextAlign = "left" | "center" | "right";

/** Visual background theme for accent blocks (hero, cta). */
export type AccentTheme = "light" | "dark" | "violet";

/** Destination for a CTA button — matches API `destination_type`. */
export type CtaDestinationType = "bot" | "channel_post" | "url";

/** Reusable CTA config. Kept identical across hero/cta so the renderer stays uniform. */
export interface CtaConfig {
  /** Button label. Falls back to "Оставить заявку" when empty. */
  text: string;
  /** How to route the click. `bot` uses the landing's own funnel; others need `url`. */
  destinationType: CtaDestinationType;
  /** Absolute URL — required when destinationType is `channel_post` or `url`. */
  url: string;
  /** Optional Yandex.Metrika goal name fired via reachGoal on click. */
  goalName: string;
}

// ---------------------------------------------------------------------------
// Per-block data shapes
// ---------------------------------------------------------------------------

/** Hero — top of the page: headline + subheadline + CTA, optional side image. */
export interface HeroData {
  title: string;
  subtitle: string;
  cta: CtaConfig;
  /** Image displayed to the right on desktop, above on mobile. Empty = no image. */
  imageUrl: string;
  /** Alt text for the hero image (accessibility + SEO). */
  imageAlt: string;
  /** Background style — controls colors of headline/CTA contrast. */
  theme: AccentTheme;
  align: TextAlign;
}

/** Text — rich text paragraph with our subset of markdown (**bold**, _italic_, links, lists). */
export interface TextData {
  /** Markdown source. Renderer sanitises + converts to HTML. */
  markdown: string;
  align: TextAlign;
}

/** Image — standalone illustration with optional caption. */
export interface ImageData {
  url: string;
  alt: string;
  caption: string;
  width: MediaWidth;
  align: TextAlign;
}

/** Video — YouTube / VK embed by URL. Renderer detects provider from URL. */
export type VideoProvider = "youtube" | "vk" | "auto";

export interface VideoData {
  /** Full page URL (watch link) or embed URL. */
  url: string;
  provider: VideoProvider;
  /** Optional caption below the video. */
  caption: string;
  width: MediaWidth;
}

/** Features — list of 3-6 checkmarked benefits. */
export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  /** Optional emoji/icon shown before the title. Defaults to a checkmark. */
  icon: string;
}

export interface FeaturesData {
  /** Optional section heading above the list. */
  title: string;
  items: FeatureItem[];
  /** 1 = stacked list, 2/3 = grid columns on desktop. */
  columns: 1 | 2 | 3;
}

/** Quote — testimonial with author. */
export interface QuoteData {
  text: string;
  authorName: string;
  authorTitle: string;
  /** Avatar image URL. Empty = initials placeholder. */
  authorAvatarUrl: string;
}

/** FAQ — accordion of Q/A pairs. */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqData {
  title: string;
  items: FaqItem[];
}

/** About — expert card: photo + name + role + bio + up to 4 badges. */
export interface AboutData {
  photoUrl: string;
  name: string;
  role: string;
  bio: string;
  /** Trust badges: awards, certifications, membership. Max 4 in UI. */
  badges: string[];
}

/** CTA — repeat call-to-action banner further down the page. */
export interface CtaData {
  title: string;
  subtitle: string;
  cta: CtaConfig;
  theme: AccentTheme;
}

/** Footer — legal contact info required by Yandex.Direct rules. */
export interface FooterData {
  /** Legal entity name — "ИП Иванов И. И." / "ООО Ромашка". */
  legalName: string;
  /** ИНН / ОГРН(ИП) — free-form text. */
  legalId: string;
  /** Contact email. */
  email: string;
  /** Contact phone (E.164 or free-form). */
  phone: string;
  /** URL to policy page (privacy / offer). */
  policyUrl: string;
  policyLabel: string;
  /** Small print shown at the bottom. */
  disclaimer: string;
}

/** Buttons grid — сетка «плиток» с эмодзи + подписью, каждая ведёт по URL.
 *  Основной блок Mini App: 2–6 кнопок ссылок на посты канала / внешние ресурсы. */
export interface ButtonsGridItem {
  /** Текст на кнопке. */
  label: string;
  /** Куда ведёт кнопка — https://max.ru/channel/... , https://... и т. п. */
  url: string;
  /** Эмодзи слева от подписи (одна графема). Опционально. */
  emoji?: string;
  /** Кастомный цвет фона плитки (hex/rgb/css). Если пусто — используется тема. */
  bg?: string;
}

export interface ButtonsGridData {
  /** Опциональный заголовок над сеткой. */
  title?: string;
  items: ButtonsGridItem[];
}

/** Channel card — «Подпишись на канал». Показывает preview + кнопку в канал.
 *  Канал и его ссылка берутся из bots.channel_link/channel_title, поэтому здесь
 *  только текстовые настройки. */
export interface ChannelCardData {
  title: string;
  description?: string;
  buttonText: string;
}

/** Bot deeplink — «Открыть бота» с опциональным start-payload.
 *  Ведёт на https://max.ru/<bot_username>?start=<startCommand>. */
export interface BotDeeplinkData {
  title: string;
  description?: string;
  buttonText: string;
  /** payload для ?start=..., напр. "welcome" или "utm_source_ads". */
  startCommand?: string;
}

// ---------------------------------------------------------------------------
// Block wrappers — { id, type, data }
// ---------------------------------------------------------------------------

export interface HeroBlock {
  id: string;
  type: "hero";
  data: HeroData;
}

export interface TextBlock {
  id: string;
  type: "text";
  data: TextData;
}

export interface ImageBlock {
  id: string;
  type: "image";
  data: ImageData;
}

export interface VideoBlock {
  id: string;
  type: "video";
  data: VideoData;
}

export interface FeaturesBlock {
  id: string;
  type: "features";
  data: FeaturesData;
}

export interface QuoteBlock {
  id: string;
  type: "quote";
  data: QuoteData;
}

export interface FaqBlock {
  id: string;
  type: "faq";
  data: FaqData;
}

export interface AboutBlock {
  id: string;
  type: "about";
  data: AboutData;
}

export interface CtaBlock {
  id: string;
  type: "cta";
  data: CtaData;
}

export interface FooterBlock {
  id: string;
  type: "footer";
  data: FooterData;
}

export interface ButtonsGridBlock {
  id: string;
  type: "buttons_grid";
  data: ButtonsGridData;
}

export interface ChannelCardBlock {
  id: string;
  type: "channel_card";
  data: ChannelCardData;
}

export interface BotDeeplinkBlock {
  id: string;
  type: "bot_deeplink";
  data: BotDeeplinkData;
}

/** Discriminated union — narrow by `type` to get typed `data`. */
export type Block =
  | HeroBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | FeaturesBlock
  | QuoteBlock
  | FaqBlock
  | AboutBlock
  | CtaBlock
  | FooterBlock
  | ButtonsGridBlock
  | ChannelCardBlock
  | BotDeeplinkBlock;

/** Map `BlockType` -> its data shape. Handy for helpers/schemas. */
export interface BlockDataByType {
  hero: HeroData;
  text: TextData;
  image: ImageData;
  video: VideoData;
  features: FeaturesData;
  quote: QuoteData;
  faq: FaqData;
  about: AboutData;
  cta: CtaData;
  footer: FooterData;
  buttons_grid: ButtonsGridData;
  channel_card: ChannelCardData;
  bot_deeplink: BotDeeplinkData;
}

/** Map `BlockType` -> its full block wrapper. Handy for generics. */
export interface BlockByType {
  hero: HeroBlock;
  text: TextBlock;
  image: ImageBlock;
  video: VideoBlock;
  features: FeaturesBlock;
  quote: QuoteBlock;
  faq: FaqBlock;
  about: AboutBlock;
  cta: CtaBlock;
  footer: FooterBlock;
  buttons_grid: ButtonsGridBlock;
  channel_card: ChannelCardBlock;
  bot_deeplink: BotDeeplinkBlock;
}

/** Type guard: is this block of a given type? */
export function isBlockOfType<T extends BlockType>(
  block: Block,
  type: T,
): block is BlockByType[T] {
  return block.type === type;
}

/** Human-readable labels for the sidebar / inspector. */
export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Обложка",
  text: "Текст",
  image: "Картинка",
  video: "Видео",
  features: "Преимущества",
  quote: "Отзыв",
  faq: "Вопрос-ответ",
  about: "Об эксперте",
  cta: "Призыв к действию",
  footer: "Подвал",
  buttons_grid: "Сетка кнопок",
  channel_card: "Карточка канала",
  bot_deeplink: "Открыть бота",
};

/** Short descriptions shown under labels in the block picker. */
export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  hero: "Первый экран: заголовок, подзаголовок, кнопка",
  text: "Абзац с форматированием (жирный, курсив, списки)",
  image: "Одна картинка с подписью",
  video: "Видео с YouTube или VK",
  features: "Список преимуществ или этапов работы",
  quote: "Отзыв клиента с фото и должностью",
  faq: "Аккордеон с частыми вопросами",
  about: "Карточка эксперта: фото, регалии, био",
  cta: "Повторная кнопка ниже по странице",
  footer: "Контакты и юридическая информация",
  buttons_grid: "Плитки-ссылки на посты или внешние страницы",
  channel_card: "Подпиши пользователя на канал бота",
  bot_deeplink: "Открыть бота с опциональным start-payload",
};
