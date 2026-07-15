import Link from "next/link";
import type { ReactNode } from "react";
import { HELP_CATEGORIES, HELP_ARTICLES } from "@/lib/help/registry";
import { loadAllArticles } from "@/lib/help/loader";

export default async function HelpLayout({ children }: { children: ReactNode }) {
  const all = await loadAllArticles();
  const bySlug = new Map(all.map((a) => [a.slug, a.meta.title]));

  return (
    <div className="help-shell">
      <header className="help-header">
        <div className="help-header-inner">
          <Link href="/" className="help-brand">
            Maxiflow
          </Link>
          <nav className="help-nav">
            <Link href="/help">База знаний</Link>
            <Link href="/login">Войти</Link>
            <Link href="/register" className="kk-btn kk-btn-primary kk-btn-sm">
              Попробовать
            </Link>
          </nav>
        </div>
      </header>

      <div className="help-body">
        <aside className="help-sidebar">
          <div className="help-sidebar-inner">
            {HELP_CATEGORIES.map((cat) => {
              const items = HELP_ARTICLES.filter((a) => a.category === cat.id);
              if (!items.length) return null;
              return (
                <div className="help-cat" key={cat.id}>
                  <div className="help-cat-label">{cat.label}</div>
                  <ul className="help-cat-list">
                    {items.map((it) => (
                      <li key={it.slug}>
                        <Link href={`/help/${it.slug}`}>
                          {bySlug.get(it.slug) ?? it.slug}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="help-main">{children}</main>
      </div>

      <footer className="help-footer">
        <div>© Maxiflow — база знаний</div>
        <div>
          <Link href="/">На главную</Link>{" · "}
          <Link href="/login">Кабинет</Link>
        </div>
      </footer>
    </div>
  );
}
