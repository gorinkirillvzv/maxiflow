"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const COUNTER_ID = 110425150;

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

function isTenantFacing(pathname: string): boolean {
  return pathname.startsWith("/m/") || pathname.startsWith("/g/");
}

export default function YandexMetrika() {
  const pathname = usePathname() ?? "/";
  const excluded = isTenantFacing(pathname);
  const initedRef = useRef(false);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (excluded) return;
    if (typeof window === "undefined" || typeof window.ym !== "function") return;
    if (!initedRef.current) {
      initedRef.current = true;
      prevRef.current = pathname + window.location.search;
      return;
    }
    const url = window.location.origin + pathname + window.location.search;
    const opts: Record<string, string> = {};
    if (prevRef.current) opts.referer = window.location.origin + prevRef.current;
    window.ym(COUNTER_ID, "hit", url, opts);
    prevRef.current = pathname + window.location.search;
  }, [pathname, excluded]);

  if (excluded) return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">{`
        (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
        (window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}", "ym");
        ym(${COUNTER_ID}, "init", {ssr:true, webvisor:true, clickmap:true, accurateTrackBounce:true, trackLinks:true});
      `}</Script>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
