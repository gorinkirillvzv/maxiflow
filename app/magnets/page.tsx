"use client";
// Каскад — лид-магниты: список + создание. Дизайн-основа: screens/magnets.jsx
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/ui";

type Bot = { id: string; max_bot_username: string; channel_title: string | null };
type Magnet = {
  id: string; bot_id: string; title: string; description: string | null;
  delivery_text: string | null; is_active: boolean;
  bots?: { channel_title: string | null } | null;
};

const EMPTY = {
  bot_id: "", title: "", description: "",
  welcome_text: "", delivery_text: "",
  subscribe_button_text: "", check_button_text: "", not_subscribed_text: "",
};

export default function MagnetsPage() {
  const [magnets, setMagnets] = useState<Magnet[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [m, b] = await Promise.all([
      fetch("/api/magnets").then((r) => r.json()),
      fetch("/api/bots").then((r) => r.json()),
    ]);
    setMagnets(m.magnets ?? []);
    setBots(b.bots ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openForm() {
    setForm({ ...EMPTY, bot_id: bots[0]?.id ?? "" });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    setError(null);
    if (!form.bot_id) { setError("Сначала подключите бота на странице «Каналы»"); return; }
    if (!form.title.trim()) { setError("Введите название магнита"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/magnets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Shell active="magnets" title="Лид-магниты" breadcrumbs={["Контент", "Лид-магниты"]}
      rightSlot={
        <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={openForm}>
          <Icon name="plus" size={13} /> Создать магнит
        </button>
      }>
      <div style={{ padding: "20px 24px", maxWidth: 1000 }}>

        {showForm && (
          <div className="kk-card kk-pad-6" style={{ marginBottom: 16 }}>
            <SectionTitle sub="тексты сценария бота — то, что увидит подписчик">Новый лид-магнит</SectionTitle>

            <div className="kk-col kk-gap-3" style={{ marginTop: 12 }}>
              <div className="kk-row kk-gap-3">
                <div style={{ flex: 1 }}>
                  <label className="kk-label">Бот / канал</label>
                  <select className="kk-input" style={{ width: "100%", marginTop: 4 }}
                    value={form.bot_id} onChange={set("bot_id")}>
                    {bots.length === 0 && <option value="">— нет подключённых ботов —</option>}
                    {bots.map((b) => (
                      <option key={b.id} value={b.id}>{b.channel_title ?? b.max_bot_username}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="kk-label">Название (внутреннее)</label>
                  <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                    value={form.title} onChange={set("title")} placeholder="МФЦ-банкротство: инструкция" />
                </div>
              </div>

              <div>
                <label className="kk-label">Описание</label>
                <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                  value={form.description} onChange={set("description")} placeholder="Коротко о содержимом магнита" />
              </div>

              <div>
                <label className="kk-label">Приветствие (welcome) — показывается на /start</label>
                <textarea className="kk-input" rows={3} style={{ width: "100%", height: "auto", padding: 10, marginTop: 4, resize: "vertical" }}
                  value={form.welcome_text} onChange={set("welcome_text")}
                  placeholder="Привет! Чтобы получить материал — подпишись на канал и нажми кнопку ниже." />
              </div>

              <div>
                <label className="kk-label">Текст выдачи (delivery) — после подтверждения подписки</label>
                <textarea className="kk-input" rows={4} style={{ width: "100%", height: "auto", padding: 10, marginTop: 4, resize: "vertical" }}
                  value={form.delivery_text} onChange={set("delivery_text")}
                  placeholder="Спасибо за подписку! Держи материалы: ..." />
              </div>

              <div className="kk-row kk-gap-3">
                <div style={{ flex: 1 }}>
                  <label className="kk-label">Кнопка «подписаться»</label>
                  <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                    value={form.subscribe_button_text} onChange={set("subscribe_button_text")} placeholder="Подписаться на канал" />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="kk-label">Кнопка «я подписался»</label>
                  <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                    value={form.check_button_text} onChange={set("check_button_text")} placeholder="Я подписался" />
                </div>
              </div>

              <div>
                <label className="kk-label">Текст «не вижу подписки»</label>
                <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                  value={form.not_subscribed_text} onChange={set("not_subscribed_text")}
                  placeholder="Не вижу подписки. Подпишись и нажми кнопку ещё раз." />
              </div>

              <div className="kk-xs kk-muted">Пустые поля заполнятся значениями по умолчанию.</div>

              {error && (
                <div className="kk-sm" style={{ color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <div className="kk-row kk-gap-2">
                <button className="kk-btn kk-btn-accent" onClick={save} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Сохраняю…" : "Создать магнит"}
                </button>
                <button className="kk-btn kk-btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="kk-muted kk-sm" style={{ padding: 40, textAlign: "center" }}>Загрузка…</div>
        ) : magnets.length === 0 ? (
          <div className="kk-card kk-pad-6" style={{ textAlign: "center", color: "var(--n-500)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--brand-violet-12)", color: "var(--brand-violet)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
              <Icon name="magnet" size={22} />
            </div>
            <div className="kk-h4" style={{ color: "var(--brand-ink)" }}>Пока нет магнитов</div>
            <div className="kk-sm" style={{ marginTop: 4 }}>Создайте первый — его будет выдавать бот за подписку.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {magnets.map((m) => (
              <div key={m.id} className="kk-card kk-pad-5">
                <div className="kk-row kk-gap-3">
                  <div style={{ width: 44, height: 56, borderRadius: 6, background: "#FF6B57", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11 }}>
                    MAX
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
                    <div className="kk-xs kk-muted">{m.bots?.channel_title ?? "канал"}</div>
                    <div style={{ marginTop: 6 }}>
                      <span className={`kk-chip ${m.is_active ? "kk-chip-green" : ""}`} style={{ height: 20, fontSize: 11 }}>
                        {m.is_active ? "активен" : "выключен"}
                      </span>
                    </div>
                  </div>
                </div>
                {m.description && (
                  <div className="kk-sm kk-muted" style={{ marginTop: 10, lineHeight: 1.5 }}>{m.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
