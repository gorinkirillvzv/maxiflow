"use client";
// Каскад — форма входа / регистрации
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "./Shell";
import { Icon } from "./Icon";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  // 2FA — если у пользователя есть TOTP factor, после ввода пароля
  // показываем второй шаг со вводом 6-значного кода.
  const [mfaStep, setMfaStep] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            // ссылка подтверждения всегда должна вести на прод, даже если человек
            // регистрируется с dev-стенда — иначе Supabase записывает localhost в письмо.
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://maxiflow.ru"}/auth/callback`,
          },
        });
        if (error) throw error;
        // Supabase для защиты от перебора почт не возвращает ошибку, если
        // email уже зарегистрирован — он присылает фейкового юзера с пустым
        // identities. Ловим именно этот случай.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError("Этот email уже зарегистрирован. Войдите вместо регистрации.");
          return;
        }
        // если подтверждение почты выключено — сессия уже есть
        if (data.session) {
          setRedirecting(true);
          router.push("/dashboard");
          router.refresh();
        } else {
          setSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email, password,
        });
        if (error) throw error;
        // Если у юзера включён 2FA — Supabase отдаёт сессию AAL1, для полного доступа
        // нужен второй фактор. Проверяем через AAL.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totp = factors?.totp?.find((f) => f.status === "verified");
          if (totp) {
            const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
            if (chErr) throw chErr;
            setMfaStep({ factorId: totp.id, challengeId: ch.id });
            return;
          }
        }
        setRedirecting(true);
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Что-то пошло не так";
      setError(translateError(msg));
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaStep) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaStep.factorId,
        challengeId: mfaStep.challengeId,
        code: mfaCode.trim(),
      });
      if (error) throw error;
      setRedirecting(true);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неверный код";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (redirecting) {
    return (
      <div className="kk" style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        background: "var(--brand-paper)", padding: 24,
      }}>
        <div className="kk-col kk-gap-3" style={{ textAlign: "center", alignItems: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            border: "4px solid var(--n-100)",
            borderTopColor: "var(--brand-violet)",
            animation: "kk-spin 0.8s linear infinite",
          }} />
          <div className="kk-h4">Открываем кабинет…</div>
          <div className="kk-sm kk-muted">Подгружаем данные, секунду</div>
        </div>
        <style>{`@keyframes kk-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="kk" style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--brand-paper)", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="kk-row kk-gap-3" style={{ justifyContent: "center", marginBottom: 24 }}>
          <BrandMark size={34} />
          <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em" }}>Каскад</span>
        </div>

        <div className="kk-card kk-pad-6">
          {mfaStep ? (
            <>
              <div className="kk-h3" style={{ marginBottom: 4 }}>Код из приложения</div>
              <div className="kk-sm kk-muted" style={{ marginBottom: 20 }}>
                Открой Google Authenticator, Яндекс.Ключ или другой ваш TOTP-аппликатор
                и введи 6-значный код.
              </div>
              <form onSubmit={submitMfa} className="kk-col kk-gap-3">
                <input className="kk-input" autoComplete="one-time-code" inputMode="numeric"
                  maxLength={6} pattern="\d{6}" required autoFocus placeholder="123456"
                  value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  style={{ width: "100%", marginTop: 4, letterSpacing: "0.22em", fontSize: 18, fontFamily: "var(--font-mono)", textAlign: "center" }} />
                {error && (
                  <div className="kk-sm" style={{ color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading || mfaCode.length !== 6}
                  className="kk-btn kk-btn-accent kk-btn-lg"
                  style={{ width: "100%", opacity: (loading || mfaCode.length !== 6) ? 0.6 : 1 }}>
                  {loading ? "Проверяю…" : "Войти"}
                </button>
                <button type="button" className="kk-btn kk-btn-ghost kk-btn-sm"
                  onClick={() => { setMfaStep(null); setMfaCode(""); setError(null); }}>
                  ← Назад
                </button>
              </form>
            </>
          ) : sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--success-12)", color: "#0A7A3C", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <Icon name="check" size={24} strokeWidth={2.5} />
              </div>
              <div className="kk-h4" style={{ marginBottom: 6 }}>Проверьте почту</div>
              <div className="kk-sm kk-muted">
                Отправили ссылку для подтверждения на <b>{email}</b>. Перейдите по ней, чтобы войти.
              </div>
            </div>
          ) : (
            <>
              <div className="kk-h3" style={{ marginBottom: 4 }}>
                {isRegister ? "Регистрация" : "Вход в кабинет"}
              </div>
              <div className="kk-sm kk-muted" style={{ marginBottom: 20 }}>
                {isRegister
                  ? "Подключите канал MAX и считайте подписки из Директа"
                  : "Рады видеть снова"}
              </div>

              <form onSubmit={onSubmit} className="kk-col kk-gap-3">
                {isRegister && (
                  <div>
                    <label className="kk-label">Имя</label>
                    <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                      value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Как к вам обращаться" autoComplete="name" />
                  </div>
                )}
                <div>
                  <label className="kk-label">Email</label>
                  <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" />
                </div>
                <div>
                  <label className="kk-label">Пароль</label>
                  <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                    type="password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    autoComplete={isRegister ? "new-password" : "current-password"} />
                </div>

                {error && (
                  <div className="kk-sm" style={{ color: "var(--danger)", background: "var(--brand-coral-12)", padding: "8px 12px", borderRadius: 8 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="kk-btn kk-btn-accent kk-btn-lg"
                  style={{ width: "100%", marginTop: 4, opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Минуту…" : isRegister ? "Создать аккаунт" : "Войти"}
                </button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <div className="kk-sm kk-muted" style={{ textAlign: "center", marginTop: 16 }}>
            {isRegister ? "Уже есть аккаунт? " : "Ещё нет аккаунта? "}
            <Link href={isRegister ? "/login" : "/register"}
              style={{ color: "var(--brand-violet)", fontWeight: 600 }}>
              {isRegister ? "Войти" : "Зарегистрироваться"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Неверный email или пароль";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Этот email уже зарегистрирован";
  if (m.includes("password")) return "Пароль слишком короткий — минимум 6 символов";
  if (m.includes("email")) return "Проверьте правильность email";
  return msg;
}
