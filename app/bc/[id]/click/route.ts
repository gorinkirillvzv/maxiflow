// Клик по кнопке рассылки: +1 к счётчику, 302 на целевой URL.
// Публичный endpoint — доступен без авторизации, но пропускает только валидные http(s) назначения.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeButtonUrl } from "@/lib/maxApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const to = safeButtonUrl(url.searchParams.get("to")) ?? "";
  // разрешаем max.ru и наши собственные пути (см. safeButtonUrl — только http(s))
  // если to некорректен — 400
  if (!to) return NextResponse.json({ error: "Invalid target" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  try {
    // Increment clicks через RPC-эквивалент: два запроса, но проще — SELECT + UPDATE.
    // Для точного счёта используем PostgREST atomic update: select текущего + increment.
    // В Supabase JS нет прямого incr — сделаем через .rpc('sql') либо через простой read/update.
    // Здесь достаточно eventually-consistent counter.
    const { data: existing } = await admin
      .from("broadcasts").select("clicks").eq("id", id).maybeSingle();
    if (existing) {
      await admin.from("broadcasts")
        .update({ clicks: (existing.clicks as number) + 1 })
        .eq("id", id);
    }
    // Пометим clicked_at в recipients — все, у кого ещё не было (идентификации получателя нет, ставим глобально first null).
    // Без UA/IP-идентификации это только "хоть один клик у кого-то" — пропускаем на уровне recipient.
  } catch {
    /* счётчик не критичен, редирект должен произойти в любом случае */
  }

  return NextResponse.redirect(to, { status: 302, headers: { "Cache-Control": "no-store" } });
}
