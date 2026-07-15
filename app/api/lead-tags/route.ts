// Maxiflow — назначение/снятие тега с подписчика.
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const lead_id = body.lead_id as string;
  const tag_id = body.tag_id as string;
  if (!lead_id || !tag_id) {
    return Response.json({ error: "Нужны lead_id и tag_id" }, { status: 400 });
  }

  // tenant_id берём из тега — RLS гарантирует, что это арендатор пользователя
  const { data: tag } = await supabase
    .from("tags").select("tenant_id").eq("id", tag_id).maybeSingle();
  if (!tag) return Response.json({ error: "Тег не найден" }, { status: 404 });

  const { error } = await supabase
    .from("lead_tags")
    .insert({ lead_id, tag_id, tenant_id: tag.tenant_id });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return Response.json({ ok: true }); // уже стоит — норма
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const lead_id = url.searchParams.get("lead_id");
  const tag_id = url.searchParams.get("tag_id");
  if (!lead_id || !tag_id) return Response.json({ error: "Нужны lead_id и tag_id" }, { status: 400 });

  const { error } = await supabase
    .from("lead_tags").delete()
    .eq("lead_id", lead_id).eq("tag_id", tag_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
