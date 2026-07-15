// Подтверждение опасных действий по одноразовому email-токену.
// Token валидируем, действие исполняем, помечаем used_at, пишем audit_log.
import { consumeConfirmation } from "@/lib/confirmation";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { token?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const token = body.token;
  if (!token) return Response.json({ error: "Нет токена" }, { status: 400 });

  const result = await consumeConfirmation(token);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });

  const admin = createAdminClient();
  const supabase = await createClient();

  try {
    switch (result.action) {
      case "landing.delete": {
        const id = result.payload?.id as string;
        if (!id) throw new Error("payload missing id");
        await admin.from("landings").delete().eq("id", id);
        await audit(supabase, request, {
          tenantId: result.tenantId!, action: "landing.delete.confirmed",
          targetType: "landing", targetId: id,
        });
        break;
      }
      case "ad_source.delete": {
        const id = result.payload?.id as string;
        if (!id) throw new Error("payload missing id");
        await admin.from("ad_sources").delete().eq("id", id);
        await audit(supabase, request, {
          tenantId: result.tenantId!, action: "ad_source.delete.confirmed",
          targetType: "ad_source", targetId: id,
        });
        break;
      }
      case "bot.disconnect": {
        const id = result.payload?.id as string;
        if (!id) throw new Error("payload missing id");
        // soft-delete: лиды и история не теряются, supervisor увидит is_active=false
        // на ближайшем рефреше (60с) и остановит воркер.
        await admin.from("bots").update({ is_active: false }).eq("id", id);
        await audit(supabase, request, {
          tenantId: result.tenantId!, action: "bot.disconnect.confirmed",
          targetType: "bot", targetId: id,
        });
        break;
      }
      case "bot.delete": {
        const id = result.payload?.id as string;
        if (!id) throw new Error("payload missing id");
        // hard delete: каскад на bot_admins, bot_link_tokens, landings, ad_sources,
        // media_assets, leads, funnels, magnets, scheduled_posts, broadcasts,
        // dialog_messages, funnel_jobs — настроен в миграциях через ON DELETE CASCADE.
        await admin.from("bots").delete().eq("id", id);
        await audit(supabase, request, {
          tenantId: result.tenantId!, action: "bot.delete.confirmed",
          targetType: "bot", targetId: id,
        });
        break;
      }
      default:
        return Response.json({ error: `Неизвестное действие: ${result.action}` }, { status: 400 });
    }
    return Response.json({ ok: true, action: result.action });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 500 });
  }
}
