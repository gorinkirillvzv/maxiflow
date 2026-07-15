// Инкремент счётчика кликов лендинга (вызывается с публичного /l/<slug>).
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ ok: false }, { status: 400 });
  // безопасная атомарная функция вместо склейки SQL-строки
  const supabase = createAdminClient();
  await supabase.rpc("increment_landing_counter", { p_id: id, p_field: "clicks" });
  return Response.json({ ok: true });
}
