// Реестр статей помощи. Порядок здесь определяет порядок в sidebar.
// Каждая запись должна соответствовать файлу content/help/<slug>.mdx.
// Категории для группировки — human-readable label задан ниже.

export type HelpCategoryId =
  | "start"
  | "integrations"
  | "analytics"
  | "magnets"
  | "billing";

export type HelpArticle = {
  slug: string;
  category: HelpCategoryId;
};

export const HELP_CATEGORIES: { id: HelpCategoryId; label: string; description: string }[] = [
  { id: "start", label: "Быстрый старт", description: "Первое подключение и запуск" },
  { id: "integrations", label: "Интеграции", description: "Директ, Метрика, MAX, VK" },
  { id: "analytics", label: "Аналитика", description: "Атрибуция, отчёты, цели" },
  { id: "magnets", label: "Лид-магниты", description: "Как раздать материалы за подписку" },
  { id: "billing", label: "Биллинг", description: "Тарифы, оплата, лимиты" },
];

export const HELP_ARTICLES: HelpArticle[] = [
  { slug: "quick-start", category: "start" },
  { slug: "connect-max-bot", category: "start" },
  { slug: "connect-yandex-direct", category: "integrations" },
  { slug: "metrika-goals", category: "analytics" },
  { slug: "attribution", category: "analytics" },
  { slug: "create-magnet", category: "magnets" },
  { slug: "billing", category: "billing" },
];

export function findArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function articlesByCategory(id: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === id);
}
