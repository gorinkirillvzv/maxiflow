"use client";
// Редактор блочного лендинга. Живой холст + панель добавления блоков.
// Данные подтягиваются через GET /api/landings (тот же список), сохраняются
// через PATCH с полем `blocks`. Легаси-поля (title/subtitle/image_url/...)
// не трогаем — они остаются на случай fallback-рендера.

import { use, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import LandingBuilder from "@/components/LandingBuilder";
import { newBlock } from "@/lib/landing-blocks/defaults";
import type { Block, HeroBlock } from "@/lib/landing-blocks/types";

interface LandingRow {
  id: string;
  bot_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  blocks: Block[] | null;
}

/**
 * Даже у совершенно нового лендинга рисуем хотя бы hero-блок, чтобы холст не
 * выглядел пустым и автор сразу мог поправить заголовок из легаси-полей.
 */
function seedBlocks(row: LandingRow): Block[] {
  if (Array.isArray(row.blocks) && row.blocks.length > 0) return row.blocks;
  const hero = newBlock("hero") as HeroBlock;
  hero.data.title = row.title || hero.data.title;
  hero.data.subtitle = row.subtitle || hero.data.subtitle;
  hero.data.imageUrl = row.image_url || "";
  return [hero];
}

export default function EditLandingPage(
  props: { params: Promise<{ id: string }> },
) {
  // В новой версии Next params — это Promise, разворачиваем через use().
  const { id } = use(props.params);

  const [row, setRow] = useState<LandingRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/landings");
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) {
          setError(d.error || "Не удалось загрузить лендинги");
          return;
        }
        const found = (d.landings as LandingRow[] | undefined)?.find(
          (l) => l.id === id,
        );
        if (!found) {
          setError("Лендинг не найден");
          return;
        }
        setRow(found);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Ошибка сети");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <Shell
      active="landings"
      title="Редактор лендинга"
      breadcrumbs={["Контент", "Лендинги", "Редактор"]}
    >
      {error && (
        <div
          className="kk-sm"
          style={{
            margin: "20px 24px",
            color: "var(--danger)",
            background: "var(--brand-coral-12)",
            padding: "10px 14px",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
      {!row && !error && (
        <div className="kk-muted kk-sm" style={{ padding: "20px 24px" }}>
          Загружаем…
        </div>
      )}
      {row && (
        <LandingBuilder
          landingId={row.id}
          slug={row.slug}
          initialBlocks={seedBlocks(row)}
          publicUrl={`/lp/${row.slug}`}
          botId={row.bot_id}
        />
      )}
    </Shell>
  );
}
