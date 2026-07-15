// Воронки бота: несколько на бота, выбор по команде. CRUD по funnel id.
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSubscription, PLANS } from "@/lib/billing";
import { audit } from "@/lib/audit";

const EMPTY_GRAPH = { nodes: [], edges: [] };

// GET ?bot_id= — список всех воронок бота
// GET ?id= — одна воронка по id (нужно когда не знаем bot_id, например при открытии /bot/[id] напрямую)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(request.url);
  const onlyId = url.searchParams.get("id");
  if (onlyId) {
    const { data: f } = await supabase
      .from("funnels")
      .select("id, bot_id, name, graph, draft_graph, trigger_command, is_default, is_active, allow_restart, updated_at, draft_updated_at, published_at")
      .eq("id", onlyId)
      .maybeSingle();
    if (!f) return Response.json({ error: "Воронка не найдена" }, { status: 404 });
    return Response.json({ funnel: f });
  }

  const botId = url.searchParams.get("bot_id");
  if (!botId) return Response.json({ error: "Нужен bot_id или id" }, { status: 400 });

  const { data } = await supabase
    .from("funnels")
    .select("id, name, graph, draft_graph, trigger_command, is_default, is_active, updated_at, draft_updated_at, published_at")
    .eq("bot_id", botId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: true });

  const funnels = data ?? [];
  if (funnels.length === 0) return Response.json({ funnels });

  // агрегат: сколько лидов прошло через воронку и сколько получили магнит
  const ids = funnels.map((f) => f.id);
  const { data: leadRows } = await supabase
    .from("leads")
    .select("funnel_id, magnet_sent_at, first_seen_at")
    .eq("bot_id", botId)
    .in("funnel_id", ids);
  const stats = new Map<string, { users: number; magnet: number; lastAt: string | null }>();
  for (const l of leadRows ?? []) {
    const k = l.funnel_id as string;
    if (!k) continue;
    let s = stats.get(k);
    if (!s) { s = { users: 0, magnet: 0, lastAt: null }; stats.set(k, s); }
    s.users += 1;
    if (l.magnet_sent_at) s.magnet += 1;
    if (l.first_seen_at && (!s.lastAt || l.first_seen_at > s.lastAt)) s.lastAt = l.first_seen_at;
  }
  const enriched = funnels.map((f) => {
    const s = stats.get(f.id) ?? { users: 0, magnet: 0, lastAt: null };
    return {
      ...f,
      users_count: s.users,
      magnet_count: s.magnet,
      conversion: s.users > 0 ? Math.round((s.magnet / s.users) * 100) : 0,
      last_lead_at: s.lastAt,
    };
  });

  return Response.json({ funnels: enriched });
}

// POST {bot_id, name} — создать воронку
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
  const botId = body.bot_id as string;
  if (!botId) return Response.json({ error: "Нужен bot_id" }, { status: 400 });

  const { data: bot } = await supabase
    .from("bots").select("tenant_id").eq("id", botId).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });

  // лимит воронок по тарифу
  const sub = await getOrCreateSubscription(supabase, bot.tenant_id);
  const { count: total } = await supabase
    .from("funnels").select("id", { count: "exact", head: true }).eq("tenant_id", bot.tenant_id);
  if ((total ?? 0) >= PLANS[sub.plan].funnels) {
    return Response.json({
      error: `На тарифе «${PLANS[sub.plan].name}» доступно ${PLANS[sub.plan].funnels} воронок. Обновите тариф, чтобы добавить ещё.`,
    }, { status: 403 });
  }

  // первая воронка бота становится воронкой по умолчанию
  const { count } = await supabase
    .from("funnels").select("id", { count: "exact", head: true }).eq("bot_id", botId);

  const { data, error } = await supabase
    .from("funnels")
    .insert({
      tenant_id: bot.tenant_id,
      bot_id: botId,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Новая воронка",
      graph: EMPTY_GRAPH,
      is_active: true,
      is_default: (count ?? 0) === 0,
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data.id });
}

// PUT {id, graph?, name?, trigger_command?, is_default?, is_active?} — обновить воронку
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const id = body.id as string;
  if (!id) return Response.json({ error: "Нужен id воронки" }, { status: 400 });

  const { data: funnel } = await supabase
    .from("funnels").select("bot_id").eq("id", id).single();
  if (!funnel) return Response.json({ error: "Воронка не найдена" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // правки графа из редактора идут в draft_graph (live не трогаем до publish)
  if (typeof body.graph === "object" && body.graph !== null) {
    patch.draft_graph = body.graph;
    patch.draft_updated_at = new Date().toISOString();
  }
  if (typeof body.name === "string") patch.name = body.name.trim() || "Воронка";
  if ("trigger_command" in body) {
    const t = typeof body.trigger_command === "string" ? body.trigger_command.trim() : "";
    patch.trigger_command = t || null;
  }
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (typeof body.allow_restart === "boolean") patch.allow_restart = body.allow_restart;

  // дефолтная воронка одна на бота — снимаем флаг с остальных
  if (body.is_default === true) {
    await supabase.from("funnels")
      .update({ is_default: false }).eq("bot_id", funnel.bot_id);
    patch.is_default = true;
  }

  const { error } = await supabase.from("funnels").update(patch).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// DELETE ?id= — удалить воронку
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const { data: funnel } = await supabase
    .from("funnels").select("tenant_id, bot_id, name, trigger_command, is_default").eq("id", id).single();
  if (!funnel) return Response.json({ error: "Воронка не найдена" }, { status: 404 });

  await supabase.from("funnels").delete().eq("id", id);

  if (funnel.tenant_id) {
    await audit(supabase, request, {
      tenantId: funnel.tenant_id,
      action: "funnel.delete",
      targetType: "funnel",
      targetId: id,
      before: funnel,
    });
  }

  // если удалили воронку по умолчанию — назначаем дефолт другой
  if (funnel.is_default) {
    const { data: rest } = await supabase
      .from("funnels").select("id").eq("bot_id", funnel.bot_id)
      .order("updated_at", { ascending: true }).limit(1);
    if (rest?.[0]) {
      await supabase.from("funnels").update({ is_default: true }).eq("id", rest[0].id);
    }
  }
  return Response.json({ ok: true });
}
