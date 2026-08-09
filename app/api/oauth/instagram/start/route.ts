// Старт OAuth Instagram: создаём oauth_state, редиректим на вход через Instagram.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { igAuthorizeUrl } from "@/lib/instagramApi";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("owner_auth_id", user.id).single();
  if (!tenant) return NextResponse.redirect(`${origin}/integrations?error=tenant`);

  const admin = createAdminClient();
  const { data: state, error } = await admin
    .from("oauth_states")
    .insert({ provider: "instagram", tenant_id: tenant.id })
    .select("state")
    .single();
  if (error || !state) {
    return NextResponse.redirect(`${origin}/integrations?error=state`);
  }

  const redirectUri = `${origin}/api/oauth/instagram/callback`;
  return NextResponse.redirect(igAuthorizeUrl(redirectUri, state.state));
}
