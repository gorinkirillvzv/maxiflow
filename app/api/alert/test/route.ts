// Тестовая отправка алерта (только для авторизованного юзера).
// POST /api/alert/test → бот напишет всем привязанным админам DM.
import { createClient } from "@/lib/supabase/server";
import { sendAdminAlert } from "@/lib/alert";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { sent, skipped } = await sendAdminAlert(
    `✅ *Maxiflow: тест алерта*\n\nЕсли видишь это в чате с ботом — алерты работают. Отправил: ${user.email}`,
    { fingerprint: `test:${user.id}` },
  );

  return Response.json({ ok: true, sent, skipped });
}
