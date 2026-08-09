// Callback OAuth Instagram: code → короткий токен → долгоживущий токен (~60 дней),
// затем данные аккаунта (username/id) и upsert в bots (platform=instagram).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { igExchangeCodeForToken, igGetLongLivedToken, igGetMe } from "@/lib/instagramApi";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const stateId = searchParams.get("state");
  const oauthErr = searchParams.get("error");

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/integrations?error=${reason}`);

  if (oauthErr) return fail("denied");
  if (!code || !stateId) return fail("params");

  const admin = createAdminClient();

  const { data: st } = await admin
    .from("oauth_states").select("*").eq("state", stateId).eq("provider", "instagram").single();
  if (!st) return fail("state");
  if (st.used_at) return fail("used");

  let ig;
  try {
    const short = await igExchangeCodeForToken(code, `${origin}/api/oauth/instagram/callback`);
    const long = await igGetLongLivedToken(short.access_token);
    const me = await igGetMe(long.access_token);
    ig = { token: long.access_token, expiresIn: long.expires_in, ...me };
  } catch (e) {
    console.error("instagram oauth exchange failed", e);
    return fail("token");
  }

  const igUserId = Number(ig.user_id);
  const tokenExpiresAt = new Date(Date.now() + ig.expiresIn * 1000).toISOString();

  const { data: existing } = await admin
    .from("bots")
    .select("id")
    .eq("tenant_id", st.tenant_id)
    .eq("platform", "instagram")
    .eq("max_bot_user_id", igUserId)
    .maybeSingle();

  const row = {
    tenant_id: st.tenant_id,
    platform: "instagram" as const,
    bot_token: encrypt(ig.token),
    max_bot_username: ig.username,
    max_bot_user_id: igUserId,
    channel_id: igUserId,
    channel_link: `https://instagram.com/${ig.username}`,
    channel_title: ig.name ?? ig.username,
    token_expires_at: tokenExpiresAt,
    is_active: true,
  };

  if (existing) {
    await admin.from("bots").update(row).eq("id", existing.id);
  } else {
    await admin.from("bots").insert(row);
  }

  await admin.from("oauth_states")
    .update({ used_at: new Date().toISOString() }).eq("state", stateId);

  return NextResponse.redirect(`${origin}/integrations?instagram=ok`);
}
