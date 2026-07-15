// Динамический импорт MDX-статьи. Каждый файл экспортирует default (компонент)
// и meta (frontmatter-подобный объект). Метаданные валидируются здесь.

import type { ComponentType } from "react";
import { HELP_ARTICLES, findArticle, type HelpArticle } from "./registry";

export type HelpMeta = {
  title: string;
  description: string;
  updated?: string; // "2026-07-06"
};

export type LoadedArticle = {
  slug: string;
  category: HelpArticle["category"];
  meta: HelpMeta;
  Component: ComponentType;
};

export async function loadArticle(slug: string): Promise<LoadedArticle | null> {
  const registryEntry = findArticle(slug);
  if (!registryEntry) return null;
  try {
    const mod = (await import(`@/content/help/${slug}.mdx`)) as {
      default: ComponentType;
      meta: HelpMeta;
    };
    return {
      slug,
      category: registryEntry.category,
      meta: mod.meta,
      Component: mod.default,
    };
  } catch {
    return null;
  }
}

export async function loadAllArticles(): Promise<LoadedArticle[]> {
  const loaded = await Promise.all(HELP_ARTICLES.map((a) => loadArticle(a.slug)));
  return loaded.filter((x): x is LoadedArticle => x !== null);
}
