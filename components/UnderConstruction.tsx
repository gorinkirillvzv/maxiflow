// Maxiflow — заглушка для разделов в разработке
import { Shell } from "./Shell";
import { Icon } from "./Icon";

export function UnderConstruction({ active, title }: { active: string; title: string }) {
  return (
    <Shell active={active} title={title}>
      <div style={{ display: "grid", placeItems: "center", minHeight: "calc(100vh - 56px)", padding: 40 }}>
        <div style={{ textAlign: "center", color: "var(--n-500)", maxWidth: 380 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: "var(--brand-amber-12)",
            color: "#8A5A00", display: "grid", placeItems: "center", margin: "0 auto 14px",
          }}>
            <Icon name="settings" size={26} />
          </div>
          <div className="kk-h3" style={{ color: "var(--brand-ink)" }}>Раздел в разработке</div>
          <div className="kk-sm" style={{ marginTop: 8, lineHeight: 1.5 }}>
            Этот раздел ещё не готов — мы работаем над ним. Как только функционал
            заработает, пометка исчезнет.
          </div>
        </div>
      </div>
    </Shell>
  );
}
