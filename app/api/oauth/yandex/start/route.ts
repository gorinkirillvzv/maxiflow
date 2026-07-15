// Старт OAuth Яндекс.Метрики: создаём oauth_state, редиректим на Яндекс.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const counterId = searchParams.get("counter_id");

  if (!counterId || !/^\d+$/.test(counterId)) {
    return NextResponse.redirect(`${origin}/integrations?error=counter`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("owner_auth_id", user.id).single();
  if (!tenant) return NextResponse.redirect(`${origin}/integrations?error=tenant`);

  const admin = createAdminClient();
  const { data: state, error } = await admin
    .from("oauth_states")
    .insert({ provider: "yandex_metrika", tenant_id: tenant.id, counter_id: Number(counterId) })
    .select("state")
    .single();
  if (error || !state) {
    return NextResponse.redirect(`${origin}/integrations?error=state`);
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
