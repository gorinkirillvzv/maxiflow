// Maxiflow — теги (сегменты) арендатора: CRUD.
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

type TagRow = {
  id: string; name: string; color: string; created_at: string;
  lead_tags?: { count: number }[];
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data } = await supabase
    .from("tags")
    .select("id, name, color, created_at, lead_tags(count)")
    .order("created_at", { ascending: false });

  const tags = ((data ?? []) as TagRow[]).map((t) => ({
    id: t.id, name: t.name, color: t.color, created_at: t.created_at,
    leadCount: t.lead_tags?.[0]?.count ?? 0,
  }));
  return Response.json({ tags });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const color = String(body.color ?? "violet").trim() || "violet";
  if (!name) return Response.json({ error: "Введите название тега" }, { status: 400 });
  if (name.length > 40) return Response.json({ error: "Название до 40 символов" }, { status: 400 });

  const { data: tenant } = await supabase
    .from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return Response.json({ error: "Нет рабочего пространства" }, { status: 400 });

  const { data, error } = await supabase
    .from("tags")
    .insert({ tenant_id: tenant.id, name, color })
    .select("id, name, color, created_at")
    .single();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return Response.json({ error: "Тег с таким названием уже есть" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, tag: { ...data, leadCount: 0 } });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const id = body.id as string;
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.color === "string" && body.color.trim()) patch.color = body.color.trim();
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Нечего обновлять" }, { status: 400 });
  }
  const { error } = await supabase.from("tags").update(patch).eq("id", id);
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return Response.json({ error: "Тег с таким названием уже есть" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const { data: before } = await supabase.from("tags")
    .select("tenant_id, name, color").eq("id", id).maybeSingle();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (before?.tenant_id) {
    await audit(supabase, request, {
      tenantId: before.tenant_id,
      action: "tag.delete",
      targetType: "tag",
      targetId: id,
      before,
    });
  }
  return Response.json({ ok: true });
}
