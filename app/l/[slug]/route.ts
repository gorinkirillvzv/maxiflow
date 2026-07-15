// Публичный мини-лендинг для рекламы Директа.
// На страницу прилетает с ?yclid=...&c=... — её Метрика тенанта зарегистрирует
// как визит, чтобы офлайн-конверсия потом сматчилась. По клику CTA — переход
// в max.ru/<bot>?start=...yclid_{yclid}_c_{campaign} (с пробросом параметров).
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const esc = (s: string) => s
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const escJs = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/</g, "\\u003c");

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const supabase = createAdminClient();

  const { data: lp } = await supabase
    .from("landings")
    .select("id, bot_id, tenant_id, title, subtitle, image_url, button_text, funnel_trigger, goal_name, is_published, destination_type, destination_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!lp || !lp.is_published) {
    return new Response("not found", { status: 404 });
  }

  const { data: bot } = await supabase
    .from("bots").select("max_bot_username").eq("id", lp.bot_id).single();
  if (!bot) return new Response("bot missing", { status: 410 });

  const { data: cfg } = await supabase
    .from("metrika_configs").select("counter_id")
    .eq("tenant_id", lp.tenant_id).eq("is_active", true).maybeSingle();

  // безопасная атомарная функция вместо склейки SQL-строки
  supabase.rpc("increment_landing_counter", { p_id: lp.id, p_field: "views" })
    .then(() => null, () => null);

  const counter = cfg?.counter_id ?? null;
  const title = lp.title;
  const subtitle = lp.subtitle ?? "";
  const image = lp.image_url ?? "";
  const buttonText = lp.button_text ?? "Открыть в MAX";
  const trigger = (lp.funnel_trigger ?? "").trim();
  const destinationType = (lp.destination_type ?? "bot") as "bot" | "channel_post";
  const destinationUrl = (lp.destination_url ?? "").trim();

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
${counter ? `<script type="text/javascript">
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${counter}, "init", { defer:false, clickmap:false, trackLinks:false, accurateTrackBounce:false });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/${counter}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>` : ""}
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:linear-gradient(180deg,#0f1216 0%,#181c24 100%);color:#e8eaee;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100%}
  .wrap{max-width:560px;margin:0 auto;padding:32px 20px 48px;text-align:center}
  .img{width:100%;max-width:420px;margin:0 auto 28px;border-radius:18px;overflow:hidden;background:#1f2530}
  .img img{width:100%;display:block}
  h1{font-size:28px;line-height:1.2;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em}
  p{margin:0 0 28px;color:#cbd1d8;font-size:16px}
  .cta{display:inline-block;width:100%;max-width:340px;padding:16px 24px;background:linear-gradient(135deg,#5B47FB,#7C5CFF);color:#fff;text-decoration:none;border:0;font-size:16px;font-weight:600;border-radius:14px;cursor:pointer;box-shadow:0 8px 24px rgba(91,71,251,0.35);transition:transform .15s ease}
  .cta:active{transform:translateY(1px)}
  .foot{margin-top:32px;font-size:11px;color:#5f6773}
  .foot a{color:#7C5CFF;text-decoration:none}
</style>
</head>
<body>
  <div class="wrap">
    ${image ? `<div class="img"><img src="${esc(image)}" alt=""></div>` : ""}
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
    <button class="cta" id="cta">${esc(buttonText)}</button>
    <div class="foot">© <a href="https://maxiflow.ru" target="_blank" rel="noreferrer">Maxiflow</a></div>
  </div>
<script>
(function(){
  var q = new URLSearchParams(location.search);
  var yclid = (q.get('yclid')||'').trim();
  var camp  = (q.get('c')||'').trim();
  var trig  = ${JSON.stringify(trigger)};
  var parts = [];
  if (trig) parts.push(trig);
  if (yclid) parts.push('yclid_' + yclid);
  if (camp) parts.push('c_' + camp);
  var startParam = parts.join('_');
  var destinationType = ${JSON.stringify(destinationType)};
  var destinationUrl  = ${JSON.stringify(destinationUrl)};
  var base = 'https://max.ru/${escJs(bot.max_bot_username)}';
  var url;
  if (destinationType === 'channel_post' && destinationUrl) {
    // ведём на пост в канале (yclid в URL не пробрасывается — MAX deeplink не поддерживает)
    url = destinationUrl;
  } else {
    url = startParam ? (base + '?start=' + encodeURIComponent(startParam)) : base;
  }
  document.getElementById('cta').addEventListener('click', function(){
    try {
      fetch('/api/landings/click?id=${lp.id}', { method: 'POST', keepalive: true }).catch(function(){});
    } catch(e){}
    ${counter && lp.goal_name ? `try { ym(${counter}, 'reachGoal', ${JSON.stringify(lp.goal_name)}); } catch(e){}` : ""}
    location.href = url;
  });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
