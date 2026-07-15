// Maxiflow — плашка бесплатного тарифа на дашборде.
// Видна только пока plan === "trial". После оплаты автоматически пропадает.
import Link from "next/link";
import { Icon } from "./Icon";
import { ProgressBar } from "./ui";

const LIMIT = 50;

function pluralDays(n: number): string {
  const m = Math.abs(n) % 100;
  const r = m % 10;
  if (m > 10 && m < 20) return "дней";
  if (r > 1 && r < 5) return "дня";
  if (r === 1) return "день";
  return "дней";
}

export function TrialBanner({ used, daysLeft }: { used: number; daysLeft: number }) {
  const overSubs = used >= LIMIT;
  const expired = daysLeft <= 0 || overSubs;

  if (expired) {
    return (
      <div className="kk-card" style={{
        marginBottom: 16, padding: 16,
        background: "var(--brand-coral-12)",
        border: "1px solid #f5c6bc",
      }}>
        <div className="kk-row kk-gap-3" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "#B12E1A" }}>
              Бесплатный тариф закончился
            </div>
            <div className="kk-xs" style={{ color: "var(--n-600)", marginTop: 4, lineHeight: 1.5 }}>
              {overSubs
                ? `Набрано ${used} подписчиков — лимит бесплатного тарифа. `
                : "Прошло 14 дней с регистрации. "}
              Подключите тариф, чтобы продолжить приём.
            </div>
          </div>
          <Link href="/billing" className="kk-btn kk-btn-accent kk-btn-sm">
            Выбрать тариф <Icon name="arrow_r" size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="kk-card" style={{
      marginBottom: 16, padding: 16,
      background: "var(--brand-violet-12)",
      border: "1px solid var(--brand-violet-20)",
    }}>
      <div className="kk-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div className="kk-row kk-gap-2" style={{ flexWrap: "wrap" }}>
          <span className="kk-chip kk-chip-violet" style={{ height: 22, fontSize: 11.5, fontWeight: 600 }}>
            Бесплатный тариф
          </span>
          <span className="kk-sm" style={{ fontWeight: 600 }}>
            {used} / {LIMIT} подписчиков
          </span>
          <span className="kk-sm kk-muted">·</span>
          <span className="kk-sm" style={{ fontWeight: 600 }}>
            осталось {daysLeft} {pluralDays(daysLeft)}
          </span>
        </div>
        <Link href="/billing" className="kk-btn kk-btn-accent kk-btn-sm">
          Перейти к тарифам <Icon name="arrow_r" size={13} />
        </Link>
      </div>
      <ProgressBar value={used} max={LIMIT} height={6} color="var(--brand-violet)" />
      <div className="kk-xs" style={{ color: "var(--n-600)", lineHeight: 1.5, marginTop: 10 }}>
        Доступен 14 дней или до набора 50 подписчиков через сервис — обычно
        этого хватает, чтобы понять, актуален ли Maxiflow.
      </div>
    </div>
  );
}
