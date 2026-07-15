// Каскад — VK Pixel CRUD. Несколько пикселей на арендатора (например разные VK-аккаунты).
import { createClient } from "@/lib/supabase/server";

async function authTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: Response.json({ error: "Не авторизован" }, { status: 401 }) };
  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("owner_auth_id", user.id).maybeSingle();
  if (!tenant) return { supabase, error: Response.json({ error: "Арендатор не найден" }, { status: 400 }) };
  return { supabase, tenant };
}

function validate(pixelId: unknown, goalName: unknown, label: unknown): { ok: true; pixelId: string; goalName: string; label: string | null } | { ok: false; error: string } {
  const p = typeof pixelId === "string" ? pixelId.trim() : "";
  const g = typeof goalName === "string" ? goalName.trim() : "magnet_delivered";
  const l = typeof label === "string" ? label.trim().slice(0, 64) : "";
  if (!/^\d{4,}$/.test(p)) return { ok: false, error: "Pixel ID должен быть числом" };
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(g)) return { ok: false, error: "Некорректное название события" };
  return { ok: true, pixelId: p, goalName: g, label: l || null };
}

export async function GET() {
  const { supabase, tenant, error } = await authTenant();
  if (error || !tenant) return error;
  const { data, error: dbErr } = await supabase
    .from("vk_pixel_configs")
    .select("id, pixel_id, goal_name, label, is_active, created_at")
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 });
  return Response.json({ pixels: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, tenant, error } = await authTenant();
  if (error || !tenant) return error;
  let body: { pixel_id?: unknown; goal_name?: unknown; label?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const v = validate(body.pixel_id, body.goal_name, body.label);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const { data, error: dbErr } = await supabase
    .from("vk_pixel_configs")
    .insert({ tenant_id: tenant.id, pixel_id: v.pixelId, goal_name: v.goalName, label: v.label, is_active: true })
    .select("id, pixel_id, goal_name, label, is_active")
    .single();
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 });
  return Response.json({ pixel: data });
}

export async function PATCH(request: Request) {
  const { supabase, tenant, error } = await authTenant();
  if (error || !tenant) return error;
  let body: { id?: unknown; pixel_id?: unknown; goal_name?: unknown; label?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });
  const v = validate(body.pixel_id, body.goal_name, body.label);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const { data, error: dbErr } = await supabase
    .from("vk_pixel_configs")
    .update({ pixel_id: v.pixelId, goal_name: v.goalName, label: v.label, updated_at: new Date().toISOString() })
    .eq("id", id).eq("tenant_id", tenant.id)
    .select("id, pixel_id, goal_name, label").single();
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 });
  return Response.json({ pixel: data });
}

export async function DELETE(request: Request) {
  const { supabase, tenant, error } = await authTenant();
  if (error || !tenant) return error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  // soft delete — выставляем is_active=false, чтобы воркер перестал слать
  const { error: dbErr } = await supabase
    .from("vk_pixel_configs")
    .update({ is_active: false })
    .eq("id", id).eq("tenant_id", tenant.id);
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 });
  return Response.json({ ok: true });
}
