"use client";
// Двухфакторная аутентификация (TOTP) — энролл, верификация, отписка.
// Supabase mfa.enroll() выдаёт QR + secret, mfa.challenge()+verify() подтверждают.
// После успешного enroll factor переходит в статус "verified".
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";

type Factor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
};

export function MfaSettings() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  // данные текущего enroll-флоу
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = (data?.totp ?? []) as Factor[];
    setFactors(totp);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function startEnroll() {
    setError(null);
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Maxiflow ${new Date().toLocaleDateString("ru-RU")}`,
      });
      if (error) throw error;
      setEnrollData({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setEnrolling(false);
    }
  }

  async function cancelEnroll() {
    if (enrollData) {
      try { await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId }); } catch { /* noop */ }
    }
    setEnrollData(null);
    setCode("");
    setError(null);
  }

  async function verifyEnroll() {
    if (!enrollData) return;
    setError(null);
    setVerifying(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      setEnrollData(null);
      setCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неверный код");
    } finally {
      setVerifying(false);
    }
  }

  async function unenroll(factorId: string) {
    if (!confirm("Отключить 2FA? Аккаунт станет уязвимее к фишингу.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { setError(error.message); return; }
    await load();
  }

  return (
    <div className="kk-card kk-pad-5">
      <div className="kk-h4" style={{ marginBottom: 6 }}>Двухфакторная аутентификация</div>
      <div className="kk-sm kk-muted" style={{ marginBottom: 14 }}>
        Защищает от взлома: даже если пароль утечёт, вход без кода из приложения-аутентификатора невозможен.
      </div>

      {loading ? (
        <div className="kk-sm kk-muted">…</div>
      ) : factors.length > 0 ? (
        <div className="kk-col kk-gap-2" style={{ marginBottom: 12 }}>
          {factors.map((f) => (
            <div key={f.id} className="kk-row kk-gap-3" style={{
              padding: "8px 12px", borderRadius: 8, background: "var(--n-50)", alignItems: "center",
            }}>
              <span className="kk-chip kk-chip-green" style={{ height: 22 }}>Активна</span>
              <div style={{ flex: 1 }}>
                <div className="kk-sm" style={{ fontWeight: 500 }}>
                  {f.friendly_name || "TOTP"}
                </div>
                <div className="kk-xs kk-muted">
                  с {new Date(f.created_at).toLocaleDateString("ru-RU")}
                </div>
              </div>
              <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }}
                onClick={() => unenroll(f.id)}>Отключить</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="kk-sm kk-muted" style={{ marginBottom: 12 }}>
          Сейчас 2FA выключена.
        </div>
      )}

      {!enrollData && factors.length === 0 && (
        <button className="kk-btn kk-btn-accent" onClick={startEnroll} disabled={enrolling}>
          <Icon name="shield" size={14} /> {enrolling ? "Готовлю…" : "Включить 2FA"}
        </button>
      )}

      {enrollData && (
        <div className="kk-col kk-gap-3" style={{ marginTop: 6 }}>
          <div className="kk-sm">
            <b>1.</b> Открой приложение-аутентификатор (Google Authenticator, Яндекс.Ключ, 1Password, Bitwarden).
          </div>
          <div className="kk-sm"><b>2.</b> Отсканируй QR-код или введи секрет вручную:</div>
          <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ background: "white", padding: 10, borderRadius: 10 }}>
              <div dangerouslySetInnerHTML={{ __html: enrollData.qr }}
                style={{ width: 160, height: 160 }} />
            </div>
            <div className="kk-col kk-gap-2" style={{ flex: 1, minWidth: 220 }}>
              <div className="kk-xs kk-muted">Секрет (если QR не подходит):</div>
              <code style={{
                fontFamily: "var(--font-mono)", fontSize: 12, padding: "8px 10px",
                background: "var(--n-50)", borderRadius: 6, wordBreak: "break-all",
              }}>{enrollData.secret}</code>
              <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ alignSelf: "flex-start" }}
                onClick={() => navigator.clipboard?.writeText(enrollData.secret)}>
                Скопировать секрет
              </button>
            </div>
          </div>
          <div className="kk-sm"><b>3.</b> Введи 6-значный код из приложения:</div>
          <div className="kk-row kk-gap-2">
            <input className="kk-input" autoComplete="one-time-code" inputMode="numeric"
              maxLength={6} pattern="\d{6}" placeholder="123456"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={{ width: 140, letterSpacing: "0.18em", fontFamily: "var(--font-mono)" }} />
            <button className="kk-btn kk-btn-accent" onClick={verifyEnroll}
              disabled={verifying || code.length !== 6}>
              {verifying ? "Проверяю…" : "Подтвердить"}
            </button>
            <button className="kk-btn kk-btn-ghost" onClick={cancelEnroll}>Отмена</button>
          </div>
        </div>
      )}

      {error && (
        <div className="kk-sm" style={{
          marginTop: 10, color: "var(--danger)",
          background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8,
        }}>{error}</div>
      )}
    </div>
  );
}
