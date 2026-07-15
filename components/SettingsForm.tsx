"use client";
// Maxiflow — форма настроек: профиль, рабочее пространство, выход.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";
import { MfaSettings } from "./MfaSettings";

export function SettingsForm({ email, name, tenantId, tenantName }: {
  email: string; name: string; tenantId: string; tenantName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [workspace, setWorkspace] = useState(tenantName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const dirty = displayName !== name || workspace !== tenantName;

  async function save() {
    setSaving(true);
    setStatus(null);
    const supabase = createClient();
    try {
      if (displayName !== name) {
        const { error } = await supabase.auth.updateUser({ data: { name: displayName } });
        if (error) throw error;
      }
      if (workspace !== tenantName) {
        const { error } = await supabase.from("tenants").update({ name: workspace }).eq("id", tenantId);
        if (error) throw error;
      }
      setStatus("Сохранено");
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="kk-col kk-gap-4" style={{ maxWidth: 620 }}>
      {/* профиль */}
      <div className="kk-card kk-pad-5">
        <div className="kk-h4" style={{ marginBottom: 14 }}>Профиль</div>
        <label className="kk-label">Email</label>
        <input className="kk-input" disabled value={email}
          style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "var(--n-50)", color: "var(--n-500)" }} />
        <label className="kk-label">Ваше имя</label>
        <input className="kk-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Как к вам обращаться"
          style={{ width: "100%", marginTop: 4 }} />
      </div>

      {/* рабочее пространство */}
      <div className="kk-card kk-pad-5">
        <div className="kk-h4" style={{ marginBottom: 14 }}>Рабочее пространство</div>
        <label className="kk-label">Название</label>
        <input className="kk-input" value={workspace} onChange={(e) => setWorkspace(e.target.value)}
          placeholder="Например: Моя школа"
          style={{ width: "100%", marginTop: 4 }} />
        <div className="kk-xs kk-muted" style={{ marginTop: 6 }}>
          Отображается в боковом меню кабинета.
        </div>
      </div>

      <div className="kk-row kk-gap-3">
        <button className="kk-btn kk-btn-accent" onClick={save} disabled={saving || !dirty}
          style={{ opacity: saving || !dirty ? 0.6 : 1 }}>
          {saving ? "Сохраняю…" : "Сохранить изменения"}
        </button>
        {status && <span className="kk-sm kk-muted">{status}</span>}
      </div>

      {/* 2FA */}
      <MfaSettings />

      {/* сессия */}
      <div className="kk-card kk-pad-5">
        <div className="kk-h4" style={{ marginBottom: 6 }}>Сессия</div>
        <div className="kk-sm kk-muted" style={{ marginBottom: 12 }}>
          Выйти из аккаунта на этом устройстве.
        </div>
        <button className="kk-btn kk-btn-outline" onClick={signOut} disabled={signingOut}>
          <Icon name="arrow_r" size={15} /> {signingOut ? "Выхожу…" : "Выйти из аккаунта"}
        </button>
      </div>
    </div>
  );
}
