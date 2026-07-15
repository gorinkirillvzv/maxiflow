// Публичный рендер лендинга по slug (новый блочный конструктор).
// Server component:
//   * читает строку `landings` через service-role клиент (обходит RLS),
//   * фиксит счётчик просмотров через RPC (fire-and-forget),
//   * если у лендинга есть массив `blocks` — рендерит через BlockList;
//   * иначе — fallback на легаси-разметку (title/subtitle/image/CTA),
//     чтобы старые лендинги без блоков продолжали работать.
//
// Стили публичного лендинга живут в /app/lp/lp.css и подключаются здесь.
// Легаси-роут /l/[slug] остаётся отдельно (он сам генерирует HTML для рекламы
// Директа) — здесь только человекочитаемая версия для новой сборки.

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BlockList } from "@/components/landing-blocks/BlockRenderer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Block } from "@/lib/landing-blocks/types";

import "@/app/lp/lp.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LandingRow {
  id: string;
  bot_id: string;
  tenant_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  button_text: string | null;
  funnel_trigger: string | null;
  goal_name: string | null;
  destination_type: "bot" | "channel_post" | null;
  destination_url: string | null;
  is_published: boolean;
  blocks: unknown;
}

/** Узкий гвард: превращает `unknown` из БД в типизированный массив блоков. */
function toBlocks(raw: unknown): Block[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return null;
  // Не валидируем каждое поле — BlockRenderer.default в switch отсеивает
  // неизвестные type и возвращает null. Это достаточная защита от кривой БД.
  return raw as Block[];
}

async function loadLanding(slug: string): Promise<LandingRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("landings")
    .select(
      "id, bot_id, tenant_id, slug, title, subtitle, image_url, button_text, funnel_trigger, goal_name, destination_type, destination_url, is_published, blocks",
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as LandingRow | null) ?? null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const lp = await loadLanding(slug);
  if (!lp) return { title: "Не найдено" };
  return {
    title: lp.title,
    description: lp.subtitle ?? undefined,
    // Лендинги-под-Директ не индексируем — трафик приходит из объявлений.
    robots: { index: false, follow: false },
  };
}

export default async function PublicLandingPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const lp = await loadLanding(slug);
  if (!lp || !lp.is_published) notFound();

  // Атомарный инкремент счётчика — не ждём результат, чтобы не тормозить рендер.
  // Ошибка не критична (страница всё равно показана), поэтому глушим.
  const admin = createAdminClient();
  admin
    .rpc("increment_landing_counter", { p_id: lp.id, p_field: "views" })
    .then(() => null, () => null);

  const blocks = toBlocks(lp.blocks);

  return (
    <main className="lp-page">
      {blocks ? (
        <BlockList blocks={blocks} landingId={lp.id} />
      ) : (
        <LegacyFallback landing={lp} />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Fallback для старых лендингов без blocks — используем те же .lp-* примитивы,
// чтобы визуально совпадало с блочным Hero + CTA. Никакого JS: /l/[slug] уже
// отвечает за форму с yclid для рекламных кампаний.
// ---------------------------------------------------------------------------

function LegacyFallback({ landing }: { landing: LandingRow }) {
  const buttonText = landing.button_text?.trim() || "Оставить заявку";
  // Куда ведёт кнопка: если destination_url задан — на него, иначе на #lead.
  const rawUrl = landing.destination_url?.trim();
  const href = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : "#lead";
  const isExternal = href.startsWith("http");

  return (
    <section className="lp-block lp-container" data-block-type="legacy-hero">
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        {landing.image_url ? (
          <img
            className="lp-media lp-media--narrow"
            src={landing.image_url}
            alt=""
            style={{ marginBottom: 24 }}
            loading="eager"
            decoding="async"
          />
        ) : null}
        <h1 className="lp-h1">{landing.title}</h1>
        {landing.subtitle ? <p className="lp-lead">{landing.subtitle}</p> : null}
        <a
          className="lp-btn lp-btn--lg"
          href={href}
          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {buttonText}
        </a>
      </div>
    </section>
  );
}
