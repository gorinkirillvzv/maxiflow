// Список доступных шаблонов воронок (официальные + свои).
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  // RLS сам отфильтрует: видны is_official=true + tenant_id = тенанту юзера
  const { data } = await supabase
    .from("funnel_templates")
    .select("id, name, description, category, preview_url, is_official")
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: true });
  return Response.json({ templates: data ?? [] });
}
