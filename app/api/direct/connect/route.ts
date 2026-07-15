// Maxiflow — подключение Директа по коду подтверждения (verification_code flow).
// Пользователь авторизуется в Яндексе, копирует код и вставляет его в кабинете.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { directGetLogin } from "@/lib/directApi";
import { encrypt } from "@/lib/crypto";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const code = String(body.code ?? "").trim();
  if (!code) return Response.json({ error: "Введите код подтверждения" }, { status: 400 });

  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return Response.json({ error: "Нет рабочего пространства" }, { status: 400 });

  // обмен кода на access_token (redirect_uri не нужен — поток verification_code)
  const tokenRes = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.YANDEX_OAUTH_CLIENT_ID!,
      client_secret: process.env.YANDEX_OAUTH_CLIENT_SECRET!,
    }),
  });
  const tok = await tokenRes.json();
  if (!tok.access_token) {
    return Response.json(
      { error: tok.error_description || "Код не подошёл — получите новый и попробуйте снова" },
      { status: 502 },
    );
  }

  const login = await directGetLogin(tok.access_token);
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("direct_accounts").select("id").eq("tenant_id", tenant.id).maybeSingle();
  const encToken = encrypt(tok.access_token);
  if (existing) {
    await admin.from("direct_accounts").update({
      oauth_token: encToken, account_login: login, is_active: true,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await admin.from("direct_accounts").insert({
      tenant_id: tenant.id, oauth_token: encToken, account_login: login,
    });
  }
  return Response.json({ ok: true });
}
