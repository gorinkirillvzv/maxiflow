// Старт OAuth Яндекс Директа: создаём oauth_state, редиректим на Яндекс.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("owner_auth_id", user.id).single();
  if (!tenant) return NextResponse.redirect(`${origin}/campaigns?error=tenant`);

  const admin = createAdminClient();
  const { data: state, error } = await admin
    .from("oauth_states")
    .insert({ provider: "yandex_direct", tenant_id: tenant.id })
    .select("state")
    .single();
  if (error || !state) {
    return NextResponse.redirect(`${origin}/campaigns?error=state`);
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.YANDEX_OAUTH_CLIENT_ID!,
    state: state.state,
    redirect_uri: `${origin}/api/oauth/yandex/callback`,
    force_confirm: "yes",
  });
  return NextResponse.redirect(`https://oauth.yandex.ru/authorize?${params}`);
}
