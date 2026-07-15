// Промежуточная страница для рекламного редиректа Директ → MAX.
// Метрика тенанта успевает зарегистрировать визит с yclid, чтобы офлайн-конверсия
// потом сматчилась. Без этого Директ-клик идёт сразу в max.ru и Метрика
// никогда не видит yclid в визите → "Привязано 0 строк из 1".
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeDecrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function escapeForJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/</g, "\\u003c");
}

async function createTgInvite(token: string, chatId: number): Promise<string | null> {
  const name = `mfx_${Math.random().toString(36).slice(2, 12)}`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, name, creates_join_request: false }),
    });
    const j = await r.json();
    if (!j.ok) { console.error("createChatInviteLink:", j.description); return null; }
    return j.result.invite_link as string;
  } catch (e) {
    console.error("createChatInviteLink throw:", e);
    return null;
  }
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ bot: string }> },
) {
  const { bot } = await ctx.params;
  const url = new URL(request.url);
  const yclid = url.searchParams.get("yclid")?.trim() || null;
  const campaignId = url.searchParams.get("c")?.trim() || null;
  // VK Реклама: rb_clickid из макроса {{clickid}}. Прокинем как vk_<id> в start payload.
  const rawVk = url.searchParams.get("rb_clickid")?.trim() || null;
  const vkClickId = rawVk && /^[A-Za-z0-9-]{6,64}$/.test(rawVk) ? rawVk : null;
  const trigger = (url.searchParams.get("trigger") || url.searchParams.get("start") || "").trim();

  const supabase = createAdminClient();
  const { data: botRec } = await supabase
    .from("bots")
    .select("id, tenant_id, max_bot_username, platform, channel_id, bot_token, channel_post_url")
    .eq("max_bot_username", bot)
    .maybeSingle();

  if (!botRec) {
    return new Response("bot not found", { status: 404 });
  }

  // ──── Telegram: создаём персональную invite-link и редиректим на неё ────
  if (botRec.platform === "telegram" && botRec.channel_id) {
    const token = maybeDecrypt(botRec.bot_token);
    if (token) {
      const inviteLink = await createTgInvite(token, botRec.channel_id);
      if (inviteLink) {
        await supabase.from("tg_invite_attribution").insert({
          tenant_id: botRec.tenant_id,
          bot_id: botRec.id,
          invite_link: inviteLink,
          invite_name: inviteLink.split("/").pop() ?? inviteLink,
          yclid,
          direct_campaign_id: campaignId,
          vk_click_id: vkClickId,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        });
        return Response.redirect(inviteLink, 302);
      }
    }
    return Response.redirect(`https://t.me/${botRec.max_bot_username}`, 302);
  }
  // ────────────────────────────────────────────────────────────────────────

  const { data: cfg } = await supabase
    .from("metrika_configs")
    .select("counter_id")
    .eq("tenant_id", botRec.tenant_id)
    .eq("is_active", true)
    .maybeSingle();

  // Сохраняем клик в сессию — её id ставим в куку. Когда юзер позже придёт
  // через кнопку под постом на /g/<bot>, мы по куке вытащим yclid и пробросим
  // в бота. Сессия живёт 30 дней (как у Метрики ClientID).
  const sid = (globalThis.crypto?.randomUUID?.() ?? `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`).replace(/-/g, "").slice(0, 24);
  // IP клиента — нужен как fallback-ключ, если куки не передадутся в MAX-WebView
  // (Mini App-флоу). Берём первый из X-Forwarded-For (за nginx).
  const xff = request.headers.get("x-forwarded-for") || "";
  const clientIp = xff.split(",")[0]?.trim() || null;
  await supabase.from("mfx_sessions").insert({
    id: sid,
    tenant_id: botRec.tenant_id,
    bot_id: botRec.id,
    yclid,
    direct_campaign_id: campaignId,
    vk_click_id: vkClickId,
    client_ip: clientIp,
  });

  // Куда вести: 1) ?post=... из URL (приоритет — индивидуально для рекламы),
  // 2) channel_post_url у бота (дефолт), 3) сразу в бота если ничего нет.
  // ?post= должен быть max.ru URL — защита от open-redirect атак.
  const rawPostParam = url.searchParams.get("post")?.trim() || null;
  const postFromUrl = rawPostParam && /^https:\/\/max\.ru\//.test(rawPostParam) ? rawPostParam : null;
  const postUrl = postFromUrl ?? (botRec.channel_post_url as string | null)?.trim() ?? null;

  let target: string;
  if (postUrl) {
    // Сценарий «реклама → пост → кнопка». Бот узнает yclid только когда юзер
    // нажмёт кнопку под постом (она ведёт на /g/<bot>).
    target = postUrl;
  } else {
    // Классический сценарий: сразу в чат бота с подвязкой через start payload.
    const startParts = [
      trigger,
      yclid ? `yclid_${yclid}` : "",
      campaignId ? `c_${campaignId}` : "",
      vkClickId ? `vk_${vkClickId}` : "",
    ].filter(Boolean);
    const startParam = startParts.join("_");
    target = `https://max.ru/${botRec.max_bot_username}${startParam ? `?start=${encodeURIComponent(startParam)}` : ""}`;
  }

  const counter = cfg?.counter_id ?? null;
  const targetJs = escapeForJsString(target);

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Открываем бота…</title>
<style>
  html,body{margin:0;height:100%;background:#0f1216;color:#cbd1d8;font:15px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;overflow:hidden}
  .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px}
  .spin{width:44px;height:44px;border-radius:50%;border:3px solid rgba(124,92,255,.18);border-top-color:#7C5CFF;margin:0 auto 18px;animation:r .9s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  .t{font-weight:600;font-size:16px;color:#eaeef3;letter-spacing:-0.01em}
  .b{font-size:13px;opacity:.55;margin-top:8px;line-height:1.5}
  a{color:#7C5CFF;text-decoration:none}
  .dots::after{content:'';animation:d 1.4s steps(4,end) infinite}
  @keyframes d{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
</style>
${counter ? `<script type="text/javascript">
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${counter}, "init", { defer:false, clickmap:false, trackLinks:false, accurateTrackBounce:false });
</script>` : ""}
<script>
  (function () {
    var target = '${targetJs}';
    var redirected = false;
    function go() {
      if (redirected) return;
      redirected = true;
      location.replace(target);
    }
    ${counter ? `
    // Дожидаемся подтверждения от Метрики что визит реально ушёл (callback на hit).
    // Только после этого редиректим — иначе на медленном 4G visit теряется.
    try {
      ym(${counter}, "hit", location.href, { callback: go });
    } catch (e) { /* noop */ }
    // Запас на случай если callback не сработает (счётчик заблокирован, ошибка сети)
    setTimeout(go, 3000);
    ` : `go();`}
  })();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${target.replace(/"/g, "&quot;")}"></noscript>
</head>
<body>
  <div class="c">
    <div>
      <div class="spin"></div>
      <div class="t">Открываем чат с ботом<span class="dots"></span></div>
      <div class="b">Если страница задержится — <a href="${target.replace(/"/g, "&quot;")}">открой вручную</a></div>
    </div>
  </div>
</body>
</html>`;

  // Кука mfx_sid — 30 дней, SameSite=Lax (отдаётся при top-level навигации
  // с кнопок в чате/посте, при этом не отправляется на сторонние сайты).
  // Host-only (без Domain=) чтобы не делиться с поддоменами случайно.
  const cookie = `mfx_sid=${sid}; Path=/; Max-Age=${30 * 24 * 3600}; Secure; SameSite=Lax`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Set-Cookie": cookie,
    },
  });
}
