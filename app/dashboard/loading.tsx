// Скелетон дашборда — Next автоматически рендерит его пока серверный
// компонент page.tsx ждёт данных. Это устраняет «белый экран» после логина.
export default function DashboardLoading() {
  return (
    <div className="kk" style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--brand-paper)",
    }}>
      <div className="kk-col kk-gap-3" style={{ textAlign: "center", alignItems: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          border: "4px solid var(--n-100)",
          borderTopColor: "var(--brand-violet)",
          animation: "kk-spin 0.8s linear infinite",
        }} />
        <div className="kk-h4">Загружаем кабинет…</div>
        <style>{`@keyframes kk-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
