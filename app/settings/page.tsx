// Maxiflow — Настройки: профиль, рабочее пространство, выход.
import { Shell } from "@/components/Shell";
import { SettingsForm } from "@/components/SettingsForm";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .limit(1)
    .maybeSingle();

  const email = user?.email ?? "";
  const name = (user?.user_metadata?.name as string) ?? "";

  return (
    <Shell active="settings" title="Настройки" breadcrumbs={["Настройки"]}>
      <div style={{ padding: "20px 24px" }}>
        {tenant ? (
          <SettingsForm
            email={email}
            name={name}
            tenantId={tenant.id}
            tenantName={tenant.name ?? ""}
          />
        ) : (
          <div className="kk-card kk-pad-6 kk-muted kk-sm">
            Не удалось загрузить рабочее пространство.
          </div>
        )}
      </div>
    </Shell>
  );
}
