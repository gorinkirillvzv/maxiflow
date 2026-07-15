"use client";
// Maxiflow — список лендингов.
// Создание упрощено: бот + slug + заголовок → после создания сразу редирект
// в блочный редактор /landings/[id]/edit. Все остальные поля (subtitle,
// button_text, funnel_trigger, goal_name, destination_*) — легаси, их
// правит либо старый инспектор /l/[slug], либо игнорируем в новом рендере.
// Кнопка «Редактировать» ведёт на блочный редактор.
// Кнопка «Просмотр» ведёт на новый публичный рендер /lp/[slug].
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/ui";

type Bot = { id: string; max_bot_username: string; channel_title: string | null; platform?: "max" | "telegram" };
type Landing = {
  id: string; bot_id: string; slug: string;
  title: string; subtitle: string | null; image_url: string | null;
  button_text: string; funnel_trigger: string | null; goal_name: string | null;
  destination_type: "bot" | "channel_post"; destination_url: string | null;
  is_published: boolean;
  views: number; clicks: number; created_at: string;
};

const CABINET_URL = process.env.NEXT_PUBLIC_APP_URL || "https://maxiflow.ru";

export default function LandingsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [list, setList] = useState<Landing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Мини-форма создания: только необходимое, чтобы попасть в редактор.
  const [draft, setDraft] = useState<{ bot_id: string; title: string; slug: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/landings").then((r) => r.json());
    setList(d.landings ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/bots").then((r) => r.json()).then((d) => setBots(d.bots ?? []));
    load();
  }, [load]);

  function startCreate() {
    if (bots.length === 0) { setError("Сначала подключите бота"); return; }
    setError(null);
    setDraft({ bot_id: bots[0].id, title: "", slug: "" });
    setCreating(true);
  }

  async function createAndEdit() {
    if (!draft) return;
    setError(null);
    if (!draft.title.trim()) { setError("Введите заголовок"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/landings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: draft.bot_id,
          title: draft.title.trim(),
          slug: draft.slug.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Ошибка"); return; }
      // Сразу в редактор блоков — там задаётся всё остальное.
      router.push(`/landings/${d.landing.id}/edit`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Запросить удаление? На email придёт письмо для подтверждения.")) return;
    const r = await fetch(`/api/landings?id=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Ошибка"); return; }
    if (d.requires_confirmation) {
      alert(d.message || `Письмо отправлено на ${d.sent_to}. Подтверди в нём для удаления.`);
    } else {
      await load();
    }
  }

  async function togglePublished(l: Landing) {
    await fetch("/api/landings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id, is_published: !l.is_published }),
    });
    await load();
  }

  function publicUrl(slug: string): string {
    // Новый блочный рендер — им же открываем «Просмотр».
    return `${CABINET_URL}/lp/${slug}`;
  }
  function adUrl(slug: string): string {
    // Для рекламы Директа по-прежнему используем /l/<slug> — он умеет
    // прокидывать yclid в диплинк MAX и не зависит от блочной сборки.
    return `${CABINET_URL}/l/${slug}?yclid={yclid}&c={campaign_id}`;
  }

  return (
    <Shell active="landings" title="Лендинги" breadcrumbs={["Контент", "Лендинги"]}>
      <div style={{ padding: "20px 24px", maxWidth: 860 }}>
        <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <SectionTitle sub="блочный конструктор + промежуточная страница для офлайн-конверсий Метрики">
            Лендинги
          </SectionTitle>
          <button className="kk-btn kk-btn-accent" onClick={startCreate}>
            <Icon name="plus" size={14} /> Создать
          </button>
        </div>

        {error && (
          <div className="kk-sm" style={{ marginBottom: 12, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
            {error}
          </div>
        )}

        {creating && draft && (
          <div className="kk-card kk-pad-5" style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>
              Новый лендинг
            </div>
            <div className="kk-xs kk-muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
              Заполни базовое — дальше сразу окажешься в блочном редакторе, где соберёшь страницу.
            </div>
            <label className="kk-label">Бот</label>
            <select className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
              value={draft.bot_id} onChange={(e) => setDraft({ ...draft, bot_id: e.target.value })}>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>)}
            </select>

            <label className="kk-label">Заголовок (внутреннее имя)</label>
            <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
              value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Бесплатная консультация — сентябрь" />

            <label className="kk-label">URL-slug (необязательно)</label>
            <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 4 }}
              value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              placeholder="consult-sept (сгенерируется автоматически)" />
            <div className="kk-xs kk-muted" style={{ marginBottom: 14 }}>
              Итоговый URL: {CABINET_URL}/lp/<b>{draft.slug || "…"}</b>
            </div>

            <div className="kk-row kk-gap-2" style={{ marginTop: 6 }}>
              <button className="kk-btn kk-btn-accent" onClick={createAndEdit} disabled={saving}>
                {saving ? "Создаём…" : "Создать и открыть редактор"}
              </button>
              <button className="kk-btn kk-btn-ghost" onClick={() => { setCreating(false); setDraft(null); }} disabled={saving}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <div className="kk-card kk-pad-5 kk-muted kk-sm" style={{ textAlign: "center" }}>
            Пока нет лендингов. Создай первый, чтобы запустить рекламу.
          </div>
        ) : (
          <div className="kk-col kk-gap-2">
            {list.map((l) => (
              <div key={l.id} className="kk-card kk-pad-4 kk-row kk-gap-3">
                {l.image_url ? (
                  <img src={l.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: "var(--n-100)", display: "grid", placeItems: "center", color: "var(--n-400)" }}>
                    <Icon name="post" size={20} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kk-row kk-gap-2" style={{ alignItems: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.title}
                    </div>
                    {!l.is_published && <span className="kk-chip" style={{ height: 20, fontSize: 11 }}>Черновик</span>}
                  </div>
                  <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>
                    /lp/{l.slug} · 👁 {l.views} · 🖱 {l.clicks}
                  </div>
                  <div className="kk-xs" style={{ marginTop: 4, fontFamily: "var(--font-mono)", color: "var(--n-500)", wordBreak: "break-all" }}>
                    {adUrl(l.slug)}
                  </div>
                </div>
                <div className="kk-col kk-gap-1" style={{ alignItems: "stretch" }}>
                  <button
                    className="kk-btn kk-btn-accent kk-btn-sm"
                    onClick={() => router.push(`/landings/${l.id}/edit`)}
                  >
                    <Icon name="edit" size={12} /> Редактировать
                  </button>
                  <a
                    className="kk-btn kk-btn-ghost kk-btn-sm"
                    href={publicUrl(l.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Просмотр
                  </a>
                  <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => navigator.clipboard?.writeText(adUrl(l.slug))}>
                    <Icon name="copy" size={12} /> Копировать URL
                  </button>
                  <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => togglePublished(l)}>
                    {l.is_published ? "Снять" : "Опубл."}
                  </button>
                  <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }} onClick={() => remove(l.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
