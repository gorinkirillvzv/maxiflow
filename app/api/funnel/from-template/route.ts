// Создаёт новую воронку из шаблона: копирует graph шаблона в funnels.
import { createClient } from "@/lib/supabase/server";

function regenerateNodeIds(graph: { nodes: { id: string }[]; edges: { from: string; to: string; port?: string }[] }) {
  // Перегенерируем id чтобы не конфликтовали с другими воронками.
  const map: Record<string, string> = {};
  const nodes = graph.nodes.map((n) => {
    const fresh = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    map[n.id] = fresh;
    return { ...n, id: fresh };
  });
  const edges = graph.edges.map((e) => ({ ...e, from: map[e.from] ?? e.from, to: map[e.to] ?? e.to }));
  return { nodes, edges };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: { bot_id?: string; template_id?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.bot_id || !body.template_id) {
    return Response.json({ error: "Нужны bot_id и template_id" }, { status: 400 });
  }

  const { data: tmpl } = await supabase
    .from("funnel_templates")
    .select("name, graph")
    .eq("id", body.template_id)
    .maybeSingle();
  if (!tmpl) return Response.json({ error: "Шаблон не найден" }, { status: 404 });

  const { data: bot } = await supabase
    .from("bots").select("tenant_id").eq("id", body.bot_id).single();
  if (!bot) return Response.json({ error: "Бот не найден" }, { status: 404 });

  // создаём новую воронку с graph из шаблона
  const graph = regenerateNodeIds(tmpl.graph as { nodes: { id: string }[]; edges: { from: string; to: string; port?: string }[] });
  const { data: created, error } = await supabase
    .from("funnels")
    .insert({
      tenant_id: bot.tenant_id,
      bot_id: body.bot_id,
      name: tmpl.name,
      graph,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ id: created.id });
}
