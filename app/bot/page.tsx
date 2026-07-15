"use client";
// Maxiflow — список воронок бота. Клик по карточке → редактор /bot/<id>.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/ui";

type Bot = { id: string; max_bot_username: string; channel_title: string | null; platform?: "max" | "telegram" };
type Funnel = {
  id: string;
  name: string;
  trigger_command: string | null;
  is_default: boolean;
  is_active: boolean;
  updated_at?: string;
  graph?: { nodes?: unknown[]; edges?: unknown[] } | null;
  draft_graph?: { nodes?: unknown[]; edges?: unknown[] } | null;
  draft_updated_at?: string | null;
  published_at?: string | null;
  users_count?: number;
  magnet_count?: number;
  conversion?: number;
  last_lead_at?: string | null;
};

type SortKey = "updated" | "users" | "conversion";
type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_official: boolean;
};

function defaultGraph() {
  return {
    nodes: [
      { id: "start", type: "start", x: 60, y: 200, title: "Вход в бота", text: "" },
      { id: "gate",  type: "subscribe_gate", x: 340, y: 200, title: "Подписка на канал", text: "Подпишись на канал и нажми кнопку." },
      { id: "magnet", type: "magnet", x: 620, y: 200, title: "Лид-магнит", text: "Спасибо за подписку! Держи материал." },
    ],
    edges: [{ from: "start", to: "gate" }, { from: "gate", to: "magnet" }],
  };
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function FunnelsListPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [creating, setCreating] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");

  useEffect(() => {
    fetch("/api/bots").then((r) => r.json()).then(async (d) => {
      const list: Bot[] = d.bots ?? [];
      setBots(list);
      const { pickActiveBot } = await import("@/lib/active-bot");
      const pick = pickActiveBot(list);
      if (pick) setBotId(pick.id);
    });
  }, []);

  const load = useCallback(async (bid: string) => {
    const d = await fetch(`/api/funnel?bot_id=${bid}`).then((r) => r.json());
    setFunnels(d.funnels ?? []);
  }, []);
  useEffect(() => { if (botId) load(botId); }, [botId, load]);

  async function createFunnel() {
    if (!botId) return;
    setCreating(true);
    try {
      const created = await fetch("/api/funnel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, name: "Новая воронка" }),
      }).then((r) => r.json());
      if (!created.id) return;
      await fetch("/api/funnel", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: created.id, graph: defaultGraph() }),
      });
      router.push(`/bot/${created.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function openTemplates() {
    setTemplatesOpen(true);
    if (templates.length === 0) {
      const d = await fetch("/api/funnel-templates").then((r) => r.json());
      setTemplates(d.templates ?? []);
    }
  }

  async function applyTemplate(t: Template) {
    if (!botId) return;
    setCreating(true);
    try {
      const r = await fetch("/api/funnel/from-template", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, template_id: t.id }),
      });
      const d = await r.json();
      if (r.ok && d.id) router.push(`/bot/${d.id}`);
    } finally {
      setCreating(false);
      setTemplatesOpen(false);
    }
  }

  const bot = bots.find((b) => b.id === botId);

  return (
    <Shell active="bot" title="Воронки бота" breadcrumbs={["Автоматизация", "Воронки"]}>
      <div style={{ padding: "20px 24px", maxWidth: 920 }}>
        <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <SectionTitle sub="каждая воронка — отдельный сценарий бота. Запускается по ключевому слову или по умолчанию.">
            Воронки
          </SectionTitle>
          <div className="kk-row kk-gap-2">
            {bots.length > 1 && (
              <select className="kk-input kk-btn-sm" value={botId} onChange={(e) => { setBotId(e.target.value); import("@/lib/active-bot").then((m) => m.writeActiveBotId(e.target.value)); }}>
                {bots.map((b) => <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>)}
              </select>
            )}
            <button className="kk-btn kk-btn-outline" onClick={openTemplates} disabled={!botId}>
              <Icon name="post" size={14} /> Из шаблона
            </button>
            <button className="kk-btn kk-btn-accent" onClick={createFunnel} disabled={!botId || creating}>
              <Icon name="plus" size={14} /> {creating ? "Создаю…" : "Создать воронку"}
            </button>
          </div>
        </div>

        {templatesOpen && (
          <>
            <div onClick={() => setTemplatesOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.4)" }} />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 50, width: "min(560px, 90vw)", maxHeight: "80vh", overflowY: "auto",
              background: "var(--n-0)", borderRadius: 14, padding: 22,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}>
              <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                <div className="kk-h3">Готовые шаблоны</div>
                <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon" onClick={() => setTemplatesOpen(false)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
              <div className="kk-sm kk-muted" style={{ marginBottom: 14, lineHeight: 1.55 }}>
                Готовая воронка скопируется к тебе как новая — потом можно править как обычную.
              </div>
              {templates.length === 0 ? (
                <div className="kk-sm kk-muted">Загружаю…</div>
              ) : (
                <div className="kk-col kk-gap-2">
                  {templates.map((t) => (
                    <button key={t.id} className="kk-card kk-pad-4"
                      onClick={() => applyTemplate(t)}
                      style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--n-100)" }}>
                      <div className="kk-row kk-gap-2" style={{ marginBottom: 4, alignItems: "center" }}>
                        {t.is_official && <span className="kk-chip kk-chip-violet" style={{ height: 20, fontSize: 11 }}>Maxiflow</span>}
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                      </div>
                      {t.description && (
                        <div className="kk-sm kk-muted" style={{ lineHeight: 1.5 }}>{t.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!bot ? (
          <div className="kk-card kk-pad-5 kk-muted kk-sm" style={{ textAlign: "center" }}>
            Сначала подключи бота в разделе <Link href="/channels" style={{ color: "var(--brand-violet)" }}>«Каналы»</Link>.
          </div>
        ) : funnels.length === 0 ? (
          <div className="kk-card kk-pad-6" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🌱</div>
            <div className="kk-h4" style={{ marginBottom: 6 }}>У этого бота ещё нет воронок</div>
            <div className="kk-sm kk-muted" style={{ marginBottom: 16, lineHeight: 1.55 }}>
              Воронка — это сценарий, по которому бот общается с подписчиком: приветствие,
              проверка подписки на канал, выдача магнита. Создай первую воронку — будет шаблон
              из трёх блоков, который можно дорастить под себя.
            </div>
            <button className="kk-btn kk-btn-accent kk-btn-lg" onClick={createFunnel} disabled={creating}>
              <Icon name="plus" size={14} /> Создать первую воронку
            </button>
          </div>
        ) : (
          <>
            <div className="kk-row kk-gap-2" style={{ marginBottom: 14, flexWrap: "wrap" }}>
              <div className="kk-row kk-gap-2" style={{
                flex: 1, minWidth: 200, height: 34, padding: "0 10px",
                borderRadius: 9, background: "var(--n-50)",
              }}>
                <Icon name="search" size={14} />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по названию"
                  style={{ border: 0, background: "transparent", outline: "none", flex: 1, fontSize: 13 }} />
              </div>
              <select className="kk-input kk-btn-sm" style={{ width: 200 }}
                value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                <option value="updated">По обновлению</option>
                <option value="users">По числу лидов</option>
                <option value="conversion">По конверсии</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {funnels
                .filter((f) => !search.trim() || f.name.toLowerCase().includes(search.trim().toLowerCase()))
                .slice()
                .sort((a, b) => {
                  if (sortKey === "users") return (b.users_count ?? 0) - (a.users_count ?? 0);
                  if (sortKey === "conversion") return (b.conversion ?? 0) - (a.conversion ?? 0);
                  return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
                })
                .map((f) => {
                  const users = f.users_count ?? 0;
                  const magnet = f.magnet_count ?? 0;
                  const conv = f.conversion ?? 0;
                  const hasDraft = !!f.draft_updated_at && (!f.published_at || new Date(f.draft_updated_at) > new Date(f.published_at));
                  return (
                    <Link key={f.id} href={`/bot/${f.id}`}
                      className="kk-card kk-pad-5"
                      style={{
                        textDecoration: "none", color: "inherit",
                        border: "1px solid var(--n-100)",
                        display: "block",
                      }}>
                      <div className="kk-row kk-gap-2" style={{ marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                        {f.is_default && (
                          <span className="kk-chip kk-chip-violet" style={{ height: 22, fontSize: 11 }}>★ По умолчанию</span>
                        )}
                        {f.trigger_command && (
                          <span className="kk-chip" style={{ height: 22, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                            /{f.trigger_command}
                          </span>
                        )}
                        {hasDraft ? (
                          <span className="kk-chip kk-chip-amber" style={{ height: 22, fontSize: 11 }}>● Черновик</span>
                        ) : f.published_at ? (
                          <span className="kk-chip kk-chip-green" style={{ height: 22, fontSize: 11 }}>✓ Опубликовано</span>
                        ) : null}
                        {!f.is_active && (
                          <span className="kk-chip" style={{ height: 22, fontSize: 11 }}>выкл.</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, lineHeight: 1.3 }}>
                        {f.name}
                      </div>

                      {/* метрики */}
                      <div className="kk-row" style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 0, padding: "10px 0", borderTop: "1px solid var(--n-100)", borderBottom: "1px solid var(--n-100)",
                      }}>
                        <Metric label="Лидов" value={users.toLocaleString("ru-RU")} />
                        <Metric label="Магнит" value={magnet.toLocaleString("ru-RU")} />
                        <Metric label="Конверсия" value={`${conv}%`} highlight={conv > 0} />
                      </div>

                      <div className="kk-xs kk-muted" style={{ marginTop: 10 }}>
                        {f.last_lead_at
                          ? `последний лид ${fmtDate(f.last_lead_at)}`
                          : f.updated_at
                            ? `обновлено ${fmtDate(f.updated_at)}`
                            : ""}
                      </div>
                    </Link>
                  );
                })}
            </div>
          </>
        )}

        {funnels.length > 0 && (
          <div className="kk-sm kk-muted" style={{ marginTop: 24, lineHeight: 1.55, padding: "12px 14px", borderRadius: 10, background: "var(--n-25)" }}>
            <b>Как работает выбор воронки:</b> бот сравнивает текст после <code>?start=</code> с триггером каждой воронки.
            Если совпало — запускается она. Если нет совпадения / нет команды — запускается воронка
            «По умолчанию». Удобно для рекламных кампаний под разные лид-магниты.
          </div>
        )}
      </div>
    </Shell>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: 17, fontWeight: 700, lineHeight: 1.2,
        color: highlight ? "var(--brand-violet)" : "var(--brand-ink)",
      }}>
        {value}
      </div>
      <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}
