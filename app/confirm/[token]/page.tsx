// Maxiflow — подтверждение опасных операций (email-link).
// Серверный component: проверяет токен, рендерит подтверждение.
// Сам апплай делает POST /api/confirm.
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("confirmation_tokens")
    .select("token, description, action, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  const expired = !data || (data.expires_at && new Date(data.expires_at) <= new Date());
  const used = !!data?.used_at;

  return (
    <div className="kk" style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--brand-paper)", padding: 24,
    }}>
      <div className="kk-card kk-pad-6" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        {!data ? (
          <>
            <div className="kk-h3" style={{ marginBottom: 8 }}>Ссылка не найдена</div>
            <div className="kk-sm kk-muted">Возможно, токен указан с ошибкой. Сгенерируй новую ссылку в кабинете.</div>
          </>
        ) : used ? (
          <>
            <div className="kk-h3" style={{ marginBottom: 8 }}>Уже подтверждено</div>
            <div className="kk-sm kk-muted">Эта ссылка использована — действие выполнено ранее.</div>
          </>
        ) : expired ? (
          <>
            <div className="kk-h3" style={{ marginBottom: 8 }}>Ссылка истекла</div>
            <div className="kk-sm kk-muted">Подтверждения действуют 1 час. Запусти действие в кабинете заново — придёт новое письмо.</div>
          </>
        ) : (
          <>
            <div className="kk-h3" style={{ marginBottom: 12 }}>Подтвердить действие</div>
            <div className="kk-sm" style={{ marginBottom: 24, lineHeight: 1.6, padding: "12px 16px", background: "var(--brand-amber-12)", borderRadius: 10 }}>
              {data.description}
            </div>
            <ConfirmButton token={token} />
            <div className="kk-xs kk-muted" style={{ marginTop: 16 }}>
              Если ты не запускал это действие — закрой страницу, ничего не произойдёт.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
