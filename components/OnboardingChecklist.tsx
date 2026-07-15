// Maxiflow — чек-лист запуска на дашборде: ведёт от подключения канала
// до готовности запускать рекламу. Шаги отмечаются автоматически.
import Link from "next/link";
import { Icon } from "./Icon";
import { ProgressBar } from "./ui";

type Props = {
  channel: boolean;
  magnet: boolean;
  funnel: boolean;
  metrika: boolean;
  direct: boolean;
};

export function OnboardingChecklist({ channel, magnet, funnel, metrika, direct }: Props) {
  const steps = [
    { done: channel, label: "Подключить канал MAX", desc: "Бот-помощник в вашем канале", href: "/channels" },
    { done: magnet,  label: "Создать лид-магнит",   desc: "Что бот выдаёт за подписку", href: "/magnets" },
    { done: funnel,  label: "Настроить воронку",     desc: "Сценарий бота в конструкторе", href: "/bot" },
    { done: metrika, label: "Подключить Яндекс Метрику", desc: "Конверсии — чтобы Директ учился на подписчиках", href: "/integrations" },
    { done: direct,  label: "Подключить Яндекс Директ",  desc: "Расход кампаний и цена подписчика", href: "/campaigns" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  // всё настроено — компактная плашка «запускайте рекламу»
  if (doneCount === steps.length) {
    return (
      <div className="kk-card kk-pad-5" style={{ marginBottom: 16, background: "var(--success-12)" }}>
        <div className="kk-row kk-gap-3">
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--success)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="check" size={18} strokeWidth={2.6} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0A7A3C" }}>
              Maxiflow настроен — можно запускать рекламу
            </div>
            <div className="kk-xs" style={{ color: "var(--n-600)", marginTop: 2, lineHeight: 1.5 }}>
              Создайте кампанию в Яндекс Директе и ведите трафик на бота. Расход
              и стоимость подписчика — в разделе «Кампании Директа».
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kk-card kk-pad-5" style={{ marginBottom: 16 }}>
      <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="kk-h4">Запуск Maxiflow</div>
        <span className="kk-sm kk-muted">{doneCount} из {steps.length}</span>
      </div>
      <ProgressBar value={doneCount} max={steps.length} height={6} />

      <div className="kk-col" style={{ marginTop: 12 }}>
        {steps.map((s, i) => (
          <div key={i} className="kk-row kk-gap-3"
            style={{ padding: "11px 0", borderTop: i ? "1px solid var(--n-100)" : 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 99, flexShrink: 0,
              display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700,
              background: s.done ? "var(--success)" : "var(--n-100)",
              color: s.done ? "#fff" : "var(--n-500)",
            }}>
              {s.done ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: s.done ? "var(--n-400)" : "var(--brand-ink)", textDecoration: s.done ? "line-through" : "none" }}>
                {s.label}
              </div>
              <div className="kk-xs kk-muted">{s.desc}</div>
            </div>
            {!s.done && (
              <Link href={s.href} className="kk-btn kk-btn-outline kk-btn-sm">Перейти</Link>
            )}
          </div>
        ))}
      </div>

      <div className="kk-row kk-gap-2" style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "var(--brand-violet-12)" }}>
        <Icon name="rocket" size={15} stroke="var(--brand-violet-pressed)" />
        <span className="kk-xs" style={{ color: "var(--brand-violet-pressed)", fontWeight: 600 }}>
          Пройдите 5 шагов — и можно запускать рекламу в Директе
        </span>
      </div>
    </div>
  );
}
