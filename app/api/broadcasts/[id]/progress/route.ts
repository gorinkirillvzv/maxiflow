// Лёгкий прогресс-эндпоинт для polling'а: только счётчики и статус, без replied/unsubs.
// Используется UI-модалкой прогресс-бара во время отправки.
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data: br } = await supabase
    .from("broadcasts")
    .select("id, status, total, sent, failed")
    .eq("id", id)
    .maybeSingle();
  if (!br) return Response.json({ error: "Не найдено" }, { status: 404 });

  return Response.json({
    id: br.id,
    status: br.status,
    total: br.total ?? 0,
    sent: br.sent ?? 0,
    failed: br.failed ?? 0,
    done: br.status === "done" || br.status === "failed",
  });
}
