// Тип и утилиты конфигурации Mini App.
// Вместо блочного конструктора — одна форма: заголовок + описание + CTA.
// Рендерер тонкий, дизайн зашит в компонент /m/[bot].

export type MiniAppCtaKind = "bot" | "channel" | "url" | "phone";

export interface MiniAppConfig {
  title: string;               // заголовок (h1)
  description: string;         // подзаголовок/описание — multiline
  ctaText: string;             // текст на кнопке
  ctaKind: MiniAppCtaKind;     // куда ведёт: бот / канал / URL / сбор телефона
  ctaStartCommand?: string;    // для kind='bot' — payload в ?start=
  ctaUrl?: string;             // для kind='url' — целевой URL
  imageUrl?: string;           // hero-картинка сверху (опц)
  brandColor?: string;         // акцентный цвет (default var(--brand-violet) #5B47FB)
  theme?: "dark" | "light";    // светлая/тёмная тема (default dark)
  // для kind='phone': текст успеха + опциональный follow-up (открыть бота с payload после сохранения)
  successMessage?: string;
  phoneFollowUpStartCommand?: string;  // если задано — после сохранения телефона откроем бот с этим start
}

export const DEFAULT_CONFIG: MiniAppConfig = {
  title: "Банкротство с Гориным",
  description: "Помогу списать долги через МФЦ или через суд. Первая консультация — бесплатно.",
  ctaText: "Открыть чат с юристом",
  ctaKind: "bot",
  ctaStartCommand: "",
  theme: "dark",
};

/** Утилита: строит целевой URL для CTA. Пустая строка — «нет валидной цели»,
 *  на клиенте это делает кнопку no-op (лучше молчаливого перехода не туда). */
export function buildCtaUrl(
  cfg: MiniAppConfig,
  ctx: { botUsername?: string; channelLink?: string | null },
): string {
  if (cfg.ctaKind === "url") return cfg.ctaUrl || "";
  if (cfg.ctaKind === "channel") {
    // Канал без ссылки — НЕ подменяем на URL бота (юзер уйдёт не туда). Молча выключаем кнопку.
    return ctx.channelLink || "";
  }
  // bot
  if (!ctx.botUsername) return "";
  const base = `https://max.ru/${ctx.botUsername}`;
  const cmd = (cfg.ctaStartCommand || "").trim();
  return cmd ? `${base}?start=${encodeURIComponent(cmd)}` : base;
}
