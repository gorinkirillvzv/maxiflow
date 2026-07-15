// Проверка токена MAX-бота + список каналов, где он админ.
import { maxGetMe, maxListChannels } from "@/lib/maxApi";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let token: string;
  try {
    ({ token } = await request.json());
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!token || typeof token !== "string") {
    return Response.json({ error: "Вставьте токен бота" }, { status: 400 });
  }

  try {
    const bot = await maxGetMe(token.trim());
    const channels = await maxListChannels(token.trim());
    return Response.json({ bot, channels });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("401") || msg.includes("max_me")) {
      return Response.json({ error: "Токен неверный — проверьте у @MasterBot" }, { status: 400 });
    }
    return Response.json({ error: "MAX API недоступен, попробуйте ещё раз" }, { status: 502 });
  }
}
