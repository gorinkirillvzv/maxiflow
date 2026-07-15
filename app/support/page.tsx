// Maxiflow — экран ИИ-поддержки
import { Shell } from "@/components/Shell";
import { SupportChat } from "@/components/SupportChat";
import { createClient } from "@/lib/supabase/server";

export default async function SupportPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_messages")
    .select("role, content, needs_human")
    .order("created_at", { ascending: true })
    .limit(40);

  const initial = (data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
    needs_human: m.needs_human as boolean,
  }));

  return (
    <Shell active="support" title="Поддержка" breadcrumbs={["Помощь", "Поддержка"]}>
      <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
        <SupportChat initialMessages={initial} />
      </div>
    </Shell>
  );
}
