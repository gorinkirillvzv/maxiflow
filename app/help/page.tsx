import Link from "next/link";
import type { Metadata } from "next";
import { HELP_CATEGORIES } from "@/lib/help/registry";
import { loadAllArticles } from "@/lib/help/loader";

export const metadata: Metadata = {
  title: "База знаний Maxiflow",
  description:
    "Инструкции и статьи по настройке Maxiflow: подключение MAX, интеграция с Яндекс Директом и Метрикой, лид-магниты, атрибуция и биллинг.",
  alternates: { canonical: "https://maxiflow.ru/help" },
};

export default async function HelpIndex() {
  const all = await loadAllArticles();
  const byCat = new Map(
    HELP_CATEGORIES.map((c) => [c.id, all.filter((a) => a.category === c.id)]),
  );

  return (
    <div className="help-index">
      <div className="help-hero">
        <h1>База знаний Maxiflow</h1>
        <p>
          Пошаговые инструкции: как подключить MAX-бота, привязать Яндекс Директ,
          настроить магниты и разобраться с атрибуцией.
        </p>
      </div>

      <div className="help-cats-grid">
        {HELP_CATEGORIES.map((cat) => {
          const items = byCat.get(cat.id) ?? [];
          if (!items.length) return null;
          return (
            <section className="help-cat-card" key={cat.id}>
              <div className="help-cat-card-head">
                <h2>{cat.label}</h2>
                <p>{cat.description}</p>
              </div>
              <ul>
                {items.map((it) => (
                  <li key={it.slug}>
                    <Link href={`/help/${it.slug}`}>
                      <span className="help-cat-item-title">{it.meta.title}</span>
                      <span className="help-cat-item-desc">{it.meta.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
