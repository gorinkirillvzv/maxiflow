// Публикация воронки: копирует draft_graph → graph. Это та версия, которую
// исполняет бот в реальном времени. Editor видит draft, бот видит graph.
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  let body: { id?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  if (!body.id) return Response.json({ error: "Нужен id" }, { status: 400 });

  const { data: funnel } = await supabase
    .from("funnels")
    .select("id, tenant_id, name, draft_graph, graph")
    .eq("id", body.id)
    .maybeSingle();
  if (!funnel) return Response.json({ error: "Воронка не найдена" }, { status: 404 });
  if (!funnel.draft_graph) return Response.json({ error: "Нечего публиковать — черновик пуст" }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("funnels")
    .update({
      graph: funnel.draft_graph,
      published_at: now,
      updated_at: now,
    })
    .eq("id", body.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (funnel.tenant_id) {
    await audit(supabase, request, {
      tenantId: funnel.tenant_id,
      action: "funnel.publish",
      targetType: "funnel",
      targetId: body.id,
      after: { name: funnel.name },
    });
  }

  return Response.json({ ok: true, published_at: now });
}
