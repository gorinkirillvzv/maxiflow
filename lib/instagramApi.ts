// Instagram Graph API (продукт "Instagram API with Instagram Login") — только
// та часть, что нужна кабинету: OAuth-обмен кода на долгоживущий токен и
// получение данных подключённого аккаунта. Приём вебхуков (комментарии, ЛС)
// и отправка сообщений — на стороне max-bot (см. src/instagram_api.py).
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_HOST = "https://graph.instagram.com";
const GRAPH_VERSION = "v21.0";

const SCOPES = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments";

export function igAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export type IgShortLivedToken = { access_token: string; user_id: number };

export async function igExchangeCodeForToken(code: string, redirectUri: string): Promise<IgShortLivedToken> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`ig_token_exchange_${r.status}`);
  const d = await r.json();
  if (!d.access_token) throw new Error("ig_token_exchange_no_token");
  return { access_token: d.access_token, user_id: d.user_id };
}

export type IgLongLivedToken = { access_token: string; expires_in: number };

export async function igGetLongLivedToken(shortLivedToken: string): Promise<IgLongLivedToken> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    access_token: shortLivedToken,
  });
  const r = await fetch(`${GRAPH_HOST}/access_token?${params}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`ig_long_lived_exchange_${r.status}`);
  const d = await r.json();
  if (!d.access_token) throw new Error("ig_long_lived_exchange_no_token");
  return { access_token: d.access_token, expires_in: d.expires_in };
}

export type IgAccount = { user_id: string; username: string; name: string | null; account_type: string | null };

export async function igGetMe(accessToken: string): Promise<IgAccount> {
  const params = new URLSearchParams({ fields: "user_id,username,name,account_type", access_token: accessToken });
  const r = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/me?${params}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`ig_get_me_${r.status}`);
  const d = await r.json();
  return { user_id: String(d.user_id), username: d.username, name: d.name ?? null, account_type: d.account_type ?? null };
}
