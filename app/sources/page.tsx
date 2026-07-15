"use client";
// Maxiflow — источники трафика (реклама в пабликах, инфлюенсеры).
// Создаёшь источник → копируешь ссылку с короткиМ кодом → вставляешь в рекламный пост.
// Бот ловит подписчиков и привязывает к источнику. CPL = бюджет / лидов.
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/ui";

type Bot = { id: string; max_bot_username: string; channel_title: string | null; platform?: "max" | "telegram" };
type Funnel = { id: string; name: string; trigger: string | null; is_default: boolean };
type Source = {
  id: string; bot_id: string; name: string; short_code: string;
  ad_spend: number; notes: string | null;
  leads: number; subscribed: number;
  created_at: string;
};

export default function SourcesPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [list, setList] = useState<Source[]>([]);
  const [funnels, setFunnels] = useState<Record<string, Funnel[]>>({});
  const [error, setError] = useState<string | null>(null);

  // форма создания
  const [name, setName] = useState("");
  const [botId, setBotId] = useState("");
  const [spend, setSpend] = useState<string>("");
  const [trigger, setTrigger] = useState("");
  const [creating, setCreating] = useState(false);

  // редактирование
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSpend, setEditSpend] = useState("");

  const load = useCallback(async () => {
    const d = await fetch("/api/ad-sources").then((r) => r.json());
    setList(d.sources ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/bots").then((r) => r.json()).then(async (d) => {
      const list: Bot[] = d.bots ?? [];
      setBots(list);
      const { pickActiveBot } = await import("@/lib/active-bot");
      const pick = pickActiveBot(list);
      if (pick) setBotId(pick.id);
    });
    load();
  }, [load]);

  // подгрузка воронок выбранного бота для выбора триггера
  useEffect(() => {
    if (!botId || funnels[botId]) return;
    fetch(`/api/funnel?bot_id=${botId}`).then((r) => r.json()).then((d) => {
      setFunnels((m) => ({ ...m, [botId]: d.funnels ?? [] }));
    });
  }, [botId, funnels]);

  async function create() {
    setError(null);
    if (!botId || !name.trim()) { setError("Заполни бота и название"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/ad-sources", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, name: name.trim(), ad_spend: Number(spend) || 0 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setName(""); setSpend(""); setTrigger("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCreating(false);
    }
  }

  async function save(id: string) {
    await fetch("/api/ad-sources", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, ad_spend: Number(editSpend) || 0 }),
    });
    setEditingId(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Удалить источник? Привязка лидов сохранится, но имени и бюджета больше не будет.")) return;
    await fetch(`/api/ad-sources?id=${id}`, { method: "DELETE" });
    await load();
  }

  function linkFor(s: Source): string {
    const bot = bots.find((b) => b.id === s.bot_id);
    if (!bot) return "";
    const fs = funnels[s.bot_id] ?? [];
    const t = fs[0]?.trigger || "";
    const start = [t, `src_${s.short_code}`].filter(Boolean).join("_");
    return `https://max.ru/${bot.max_bot_username}?start=${encodeURIComponent(start)}`;
  }

  function cpl(s: Source): string {
    if (s.subscribed === 0) return "—";
    return `${Math.round(s.ad_spend / s.subscribed).toLocaleString("ru-RU")} ₽`;
  }

  return (
    <Shell active="sources" title="Источники трафика" breadcrumbs={["Аудитория", "Источники трафика"]}>
      <div style={{ padding: "20px 24px", maxWidth: 880 }}>
        <SectionTitle sub="реклама в чужих пабликах, у инфлюенсеров, обмены — ручной учёт бюджета и атрибуции">
          Источники
        </SectionTitle>

        {error && (
          <div className="kk-sm" style={{ marginBottom: 12, color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div className="kk-card kk-pad-5" style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Новый источник</div>
          <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap", marginBottom: 10 }}>
            <select className="kk-input" style={{ width: 220 }} value={botId} onChange={(e) => { setBotId(e.target.value); import("@/lib/active-bot").then((m) => m.writeActiveBotId(e.target.value)); }}>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>)}
            </select>
            <input className="kk-input" placeholder="Название (Канал X, 25 мая)" style={{ flex: 1, minWidth: 220 }}
              value={name} onChange={(e) => setName(e.target.value)} />
            <input className="kk-input" placeholder="Бюджет, ₽" type="number" min={0} style={{ width: 140 }}
              value={spend} onChange={(e) => setSpend(e.target.value)} />
            <button className="kk-btn kk-btn-accent" onClick={create} disabled={creating}>
              {creating ? "…" : "Создать"}
            </button>
          </div>
          <div className="kk-xs kk-muted" style={{ lineHeight: 1.5 }}>
            При создании сгенерируется ссылка с уникальным кодом — её надо дать паблику для рекламного поста.
            Подписчик кликнет → бот узнает что лид пришёл отсюда.
          </div>
        </div>

        {list.length === 0 ? (
          <div className="kk-card kk-pad-5 kk-muted kk-sm" style={{ textAlign: "center" }}>
            Источников ещё нет. Создай первый — например «Канал @marketing_pro, 25 мая».
          </div>
        ) : (
          <div className="kk-col kk-gap-2">
            {list.map((s) => {
              const link = linkFor(s);
              const isEdit = editingId === s.id;
              return (
                <div key={s.id} className="kk-card kk-pad-4">
                  <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEdit ? (
                        <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
                          <input className="kk-input kk-btn-sm" style={{ flex: 1, minWidth: 180 }}
                            value={editName} onChange={(e) => setEditName(e.target.value)} />
                          <input className="kk-input kk-btn-sm" type="number" min={0} style={{ width: 120 }}
                            value={editSpend} onChange={(e) => setEditSpend(e.target.value)} />
                          <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={() => save(s.id)}>Сохранить</button>
                          <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => setEditingId(null)}>Отмена</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.name}
                          </div>
                          <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>
                            код <code>{s.short_code}</code> · бюджет {Number(s.ad_spend).toLocaleString("ru-RU")} ₽
                          </div>
                          <div className="kk-row kk-gap-3" style={{ marginTop: 8, flexWrap: "wrap" }}>
                            <span className="kk-chip" style={{ height: 22 }}>Лидов: {s.leads}</span>
                            <span className="kk-chip kk-chip-green" style={{ height: 22 }}>Подписалось: {s.subscribed}</span>
                            <span className="kk-chip kk-chip-violet" style={{ height: 22 }}>CPL: {cpl(s)}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="kk-col kk-gap-1">
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => navigator.clipboard?.writeText(link)} title="Копировать ссылку для рекламы">
                        <Icon name="copy" size={12} /> Ссылка
                      </button>
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => {
                        setEditingId(s.id); setEditName(s.name); setEditSpend(String(s.ad_spend));
                      }}>Изменить</button>
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }} onClick={() => remove(s.id)}>Удалить</button>
                    </div>
                  </div>
                  <div className="kk-xs" style={{ marginTop: 8, fontFamily: "var(--font-mono)", color: "var(--n-500)", wordBreak: "break-all" }}>
                    {link}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="kk-card kk-pad-4 kk-xs kk-muted" style={{ marginTop: 18, lineHeight: 1.55 }}>
          <b>Как работает.</b> Каждому источнику присваивается короткий код (например <code>a3f9d2</code>),
          который зашивается в ссылку запуска бота: <code>?start=…_src_a3f9d2</code>. Бот при входе
          подписчика опознаёт код и сохраняет лида как пришедшего отсюда.
          <br /><br />
          <b>Важно.</b> Если в рекламном посте ссылка ведёт прямо на канал (а не на бота через магнит) —
          бот не запустится, и точную атрибуцию через MAX API сделать нельзя. В этом случае бюджет
          указываешь руками, а лиды считаешь сам, сверяясь с приростом канала.
        </div>
      </div>
    </Shell>
  );
}
