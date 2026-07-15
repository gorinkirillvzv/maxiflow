import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HELP_ARTICLES, HELP_CATEGORIES, articlesByCategory } from "@/lib/help/registry";
import { loadArticle, loadAllArticles } from "@/lib/help/loader";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

type Params = { slug: string };

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { slug } = await params;
  const a = await loadArticle(slug);
  if (!a) return { title: "Не найдено" };
  return {
    title: `${a.meta.title} — Maxiflow`,
    description: a.meta.description,
    alternates: { canonical: `https://maxiflow.ru/help/${slug}` },
    openGraph: {
      title: a.meta.title,
      description: a.meta.description,
      type: "article",
      url: `https://maxiflow.ru/help/${slug}`,
    },
  };
}

export default async function HelpArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const a = await loadArticle(slug);
  if (!a) notFound();

  const category = HELP_CATEGORIES.find((c) => c.id === a.category);
  const siblings = articlesByCategory(a.category);
  const allWithTitles = await loadAllArticles();
  const titleBySlug = new Map(allWithTitles.map((x) => [x.slug, x.meta.title]));
  const idx = siblings.findIndex((s) => s.slug === a.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const Article = a.Component;

  return (
    <article className="help-article">
      <nav className="help-breadcrumbs" aria-label="breadcrumbs">
        <Link href="/help">База знаний</Link>
        {category && <span> / {category.label}</span>}
      </nav>

      <header className="help-article-head">
        <h1>{a.meta.title}</h1>
        <p className="help-article-lede">{a.meta.description}</p>
        {a.meta.updated && (
          <div className="help-article-updated">Обновлено: {a.meta.updated}</div>
        )}
      </header>

      <div className="help-prose">
        <Article />
      </div>

      <nav className="help-article-nav">
        {prev ? (
          <Link href={`/help/${prev.slug}`} className="help-article-nav-item">
            <span>Предыдущая</span>
            <strong>{titleBySlug.get(prev.slug) ?? prev.slug}</strong>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/help/${next.slug}`} className="help-article-nav-item help-article-nav-next">
            <span>Следующая</span>
            <strong>{titleBySlug.get(next.slug) ?? next.slug}</strong>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
