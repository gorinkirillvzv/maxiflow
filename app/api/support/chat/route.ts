// ИИ-поддержка Maxiflow: вопрос клиента → Claude отвечает по базе знаний,
// при необходимости помечает диалог для эскалации на человека.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SUPPORT_KB } from "@/lib/support-kb";

const MODEL = "claude-opus-4-7";
const ESCALATE = "[ESCALATE]";

const SYSTEM = `Ты — ассистент поддержки сервиса Maxiflow. Помогаешь клиентам сервиса
(рекламодателям) разобраться, как им пользоваться: подключение MAX, Метрики, Директа,
создание лид-магнитов, диагностика проблем.

Правила:
- Отвечай кратко, по делу, на русском. Опирайся ТОЛЬКО на базу знаний ниже.
- Если ответа в базе знаний нет, вопрос требует доступа к аккаунту клиента, это жалоба,
  баг, вопрос оплаты, или клиент явно просит живого человека — начни ответ с токена
  ${ESCALATE} на отдельной строке, затем напиши, что передал вопрос команде поддержки.
- Не выдумывай функции, которых нет в базе знаний.

# База знаний
${SUPPORT_KB}`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("owner_auth_id", user.id).single();
  if (!tenant) return Response.json({ error: "Арендатор не найден" }, { status: 400 });

  let message: string;
  try {
    ({ message } = await request.json());
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Пустое сообщение" }, { status: 400 });
  }

  // история диалога этого арендатора
  const { data: history } = await supabase
    .from("support_messages")
    .select("role, content")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: true })
    .limit(40);

  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    })),
    { role: "user", content: message.trim() },
  ];

  let answer: string;
  try {
    const anthropic = new Anthropic(); // ANTHROPIC_API_KEY из env
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages,
    });
    answer = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (e) {
    console.error("support chat: anthropic error", e);
    return Response.json({ error: "ИИ-поддержка временно недоступна" }, { status: 502 });
  }

  const needsHuman = answer.startsWith(ESCALATE);
  if (needsHuman) answer = answer.slice(ESCALATE.length).trim();

  // сохраняем оба сообщения
  await supabase.from("support_messages").insert([
    { tenant_id: tenant.id, role: "user", content: message.trim(), needs_human: false },
    { tenant_id: tenant.id, role: "assistant", content: answer, needs_human: needsHuman },
  ]);

  return Response.json({ answer, needsHuman });
}
