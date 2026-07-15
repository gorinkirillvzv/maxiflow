// Maxiflow — JS-сниппет для внешних лендингов клиента.
// Клиент вставляет на свою страницу:
//   <script src="https://maxiflow.ru/lp/script.js?bot=<username>&trigger=<funnel>" async></script>
//   <button data-mfx-cta>Открыть в боте</button>
// Скрипт находит все элементы [data-mfx-cta] и навешивает click→редирект
// на max.ru/<bot>?start=<trigger>_yclid_<X>_c_<Y>, забирая параметры из URL.
//
// Дополнительно (если нужно):
//   <a data-mfx-cta data-mfx-trigger="other_funnel">…</a>   — переопределить триггер
//   data-mfx-src="<short_code>"                              — пометить как источник трафика
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function js(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const botUsername = (url.searchParams.get("bot") || "").trim();
  const trigger = (url.searchParams.get("trigger") || "").trim();

  if (!botUsername) {
    return js(`console.error("Maxiflow: missing 'bot' param in script src");`);
  }

  // мягкая проверка что такой бот действительно есть (не подсовываем себе чужие имена)
  const admin = createAdminClient();
  const { data: bot } = await admin
    .from("bots")
    .select("max_bot_username")
    .eq("max_bot_username", botUsername)
    .maybeSingle();
  if (!bot) {
    return js(`console.error("Maxiflow: bot '${botUsername.replace(/[^a-zA-Z0-9_]/g, "")}' not found");`);
  }

  const safeBot = JSON.stringify(botUsername);
  const safeTrigger = JSON.stringify(trigger);

  return js(`/* Maxiflow LP snippet */
(function(){
  function getParam(name){
    try { return new URLSearchParams(location.search).get(name) || ""; }
    catch(e){ return ""; }
  }
  function buildUrl(triggerOverride, srcOverride){
    var yclid = getParam("yclid").trim();
    var camp  = getParam("c").trim();
    var src   = (srcOverride || getParam("src") || "").trim();
    var t     = (triggerOverride || ${safeTrigger} || "").trim();
    var parts = [];
    if (t) parts.push(t);
    if (yclid) parts.push("yclid_" + yclid);
    if (camp)  parts.push("c_" + camp);
    if (src)   parts.push("src_" + src);
    var base = "https://max.ru/" + ${safeBot};
    return parts.length ? (base + "?start=" + encodeURIComponent(parts.join("_"))) : base;
  }
  function wire(){
    var els = document.querySelectorAll("[data-mfx-cta]");
    for (var i = 0; i < els.length; i++) (function(el){
      if (el.__mfxWired) return; el.__mfxWired = true;
      var trigger = el.getAttribute("data-mfx-trigger") || "";
      var src     = el.getAttribute("data-mfx-src")     || "";
      var url     = buildUrl(trigger, src);
      if (el.tagName === "A") {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      } else {
        el.style.cursor = "pointer";
        el.addEventListener("click", function(){ window.open(url, "_blank", "noopener,noreferrer"); });
      }
    })(els[i]);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else { wire(); }
  // на случай если кнопки появляются после загрузки (SPA, табы)
  if (window.MutationObserver) {
    try { new MutationObserver(wire).observe(document.body, { childList: true, subtree: true }); }
    catch(e){}
  }
  window.Maxiflow = { buildUrl: buildUrl, rewire: wire };
})();
`);
}
