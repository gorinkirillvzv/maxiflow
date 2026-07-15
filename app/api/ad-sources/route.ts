// Источники трафика: ручная пометка рекламы в пабликах с бюджетом.
// short_code попадает в start-payload бота через ссылку `?start=src_<code>`.
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";
import { audit } from "@/lib/audit";

function mkCode(): string {
  return randomBytes(3).toString("hex"); // 6 hex chars
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const botId = url.searchParams.get("bot_id");

  let q = supabase
    .from("ad_sources")
    .select("id, bot_id, name, short_code, ad_spend, notes, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (botId) q = q.eq("bot_id", botId);
  const { data: sources } = await q;

  // считаем лиды/подписавшихся по каждому источнику
  const ids = (sources ?? []).map((s) => s.id);
  let counts: Record<string, { leads: number; subscribed: number }> = {};
  if (ids.length) {
    const { data: leads } = await supabase
      .from("leads")
      .select("ad_source_id, subscribed_at")
      .in("ad_source_id", ids);
    for (const l of leads ?? []) {
      const k = l.ad_source_id as string;
      if (!counts[k]) counts[k] = { leads: 0, subscribed: 0 };
      counts[k].leads += 1;
      if (l.subscribed_at) counts[k].subscribed += 1;
    }
  }
  const result = (sources ?? []).map((s) => ({
    ...s,
    leads: counts[s.id]?.leads ?? 0,
    subscribed: counts[s.id]?.subscribed ?? 0,
  }));
  return Response.json({ sources: result });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }

  const botId = typeof body.bot_id === "string" ? body.bot_id : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!botId || !name) return Response.json({ error: "Нужны бот и название" }, { status: 400 });

  const { data: bot } = await supabase.from("bots").select("tenant_id").eq("id", botId).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });

  let code = mkCode();
  for (let i = 0; i < 6; i++) {
    const { data: dup } = await supabase.from("ad_sources").select("id").eq("short_code", code).maybeSingle();
    if (!dup) break;
    code = mkCode();
  }

  const row = {
    tenant_id: bot.tenant_id,
    bot_id: botId,
    name,
    short_code: code,
    ad_spend: typeof body.ad_spend === "number" ? body.ad_spend : 0,
    notes: typeof body.notes === "string" ? body.notes : null,
  };
  const { data, error } = await supabase.from("ad_sources").insert(row).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ source: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Некорректный запрос" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.ad_spend === "number") patch.ad_spend = body.ad_spend;
  if (typeof body.notes === "string" || body.notes === null) patch.notes = body.notes;

  const { data, error } = await supabase.from("ad_sources").update(patch).eq("id", id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ source: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const { data: before } = await supabase.from("ad_sources")
    .select("tenant_id, bot_id, name, short_code, ad_spend").eq("id", id).maybeSingle();
  const { error } = await supabase.from("ad_sources").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (before?.tenant_id) {
    await audit(supabase, request, {
      tenantId: before.tenant_id,
      action: "ad_source.delete",
      targetType: "ad_source",
      targetId: id,
      before,
    });
  }
  return Response.json({ ok: true });
}
