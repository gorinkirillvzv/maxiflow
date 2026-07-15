// Callback OAuth Яндекса: обмен code на токен. Ветвится по provider:
// yandex_metrika → metrika_configs, yandex_direct → direct_accounts.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { directGetLogin } from "@/lib/directApi";
import { encrypt } from "@/lib/crypto";

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
    .from("oauth_states").select("*").eq("state", stateId).single();
  if (!st) return fail("state");
  if (st.used_at) return fail("used");

  // обмен code -> access_token
  const tokenRes = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.YANDEX_OAUTH_CLIENT_ID!,
      client_secret: process.env.YANDEX_OAUTH_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/oauth/yandex/callback`,
    }),
  });
  if (!tokenRes.ok) return fail("token");
  const tok = await tokenRes.json();
  if (!tok.access_token) return fail("token");

  // --- Директ: сохраняем токен в direct_accounts ---
  if (st.provider === "yandex_direct") {
    const login = await directGetLogin(tok.access_token);
    const { data: existing } = await admin
      .from("direct_accounts").select("id").eq("tenant_id", st.tenant_id).maybeSingle();
    const encToken = encrypt(tok.access_token);
    if (existing) {
      await admin.from("direct_accounts").update({
        oauth_token: encToken, account_login: login, is_active: true,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await admin.from("direct_accounts").insert({
        tenant_id: st.tenant_id, oauth_token: encToken, account_login: login,
      });
    }
    await admin.from("oauth_states")
      .update({ used_at: new Date().toISOString() }).eq("state", stateId);
    return NextResponse.redirect(`${origin}/campaigns?direct=ok`);
  }

  // upsert metrika_configs по (tenant_id, counter_id)
  const { data: existing } = await admin
    .from("metrika_configs")
    .select("id")
    .eq("tenant_id", st.tenant_id)
    .eq("counter_id", st.counter_id)
    .maybeSingle();

  const encMetrika = encrypt(tok.access_token);
  if (existing) {
    await admin.from("metrika_configs")
      .update({ oauth_token: encMetrika, is_active: true })
      .eq("id", existing.id);
  } else {
    await admin.from("metrika_configs").insert({
      tenant_id: st.tenant_id,
      counter_id: st.counter_id,
      oauth_token: encMetrika,
      goal_name: "magnet_delivered",
    });
  }

  await admin.from("oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("state", stateId);

  return NextResponse.redirect(`${origin}/integrations?metrika=ok`);
}
