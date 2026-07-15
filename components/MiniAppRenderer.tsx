"use client";
// Публичный renderer Mini App: одна страница = один призыв.
// Ничего лишнего, полный viewport, mobile-first. Работает и в браузере MAX
// (через window.WebApp SDK, если он подгружен родительской страницей), и в
// обычном браузере (fallback на window.location / window.open).
//
// Дизайн намеренно изолирован префиксом .mini-app-* — если рендерится в
// iframe редактора внутри Shell кабинета, стили не конфликтуют.

import { useMemo, type MouseEvent } from "react";
import { buildCtaUrl, type MiniAppConfig } from "@/lib/mini-app/config";

interface Props {
  config: MiniAppConfig;
  botUsername?: string;
  channelLink?: string | null;
  preview?: boolean;
}

const DEFAULT_BRAND = "#5B47FB"; // var(--brand-violet)

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(91, 71, 251, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function openViaMaxSdk(url: string): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    WebApp?: {
      openMaxLink?: (u: string) => void;
      openLink?: (u: string) => void;
    };
  };
  const sdk = w.WebApp;
  if (!sdk) return false;
  try {
    const isMaxUrl = /(^|\/\/)([^/]*\.)?max\.ru\b/i.test(url);
    if (isMaxUrl && typeof sdk.openMaxLink === "function") {
      sdk.openMaxLink(url);
      return true;
    }
    if (typeof sdk.openLink === "function") {
      sdk.openLink(url);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export default function MiniAppRenderer({
  config,
  botUsername,
  channelLink,
  preview = false,
}: Props) {
  const brand = (config.brandColor && config.brandColor.trim()) || DEFAULT_BRAND;
  const theme = config.theme === "light" ? "light" : "dark";

  const url = useMemo(
    () => buildCtaUrl(config, { botUsername, channelLink }),
    [config, botUsername, channelLink],
  );

  const bg = theme === "dark"
    ? `linear-gradient(160deg, #0f1216 0%, #1a1520 55%, ${hexToRgba(brand, 0.22)} 100%)`
    : `linear-gradient(160deg, #fafafa 0%, #f0eff5 60%, ${hexToRgba(brand, 0.14)} 100%)`;

  const descLines = (config.description || "").split("\n");

  function handleCta(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!url) return;
    // Клиент-сайд защита от XSS: даже если через API просочился javascript:-URL,
    // здесь мы отказываемся его открывать. Whitelist: http(s) / mailto / tel / max://
    if (!/^(https?:\/\/|mailto:|tel:|max:\/\/)/i.test(url)) return;
    if (preview) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (openViaMaxSdk(url)) return;
    window.location.href = url;
  }

  return (
    <div className={`mini-app-root mini-app-${theme}`} style={{ background: bg }}>
      <style>{CSS}</style>
      <div className="mini-app-noise" aria-hidden="true" />
      <main className="mini-app-shell">
        {config.imageUrl ? (
          <div className="mini-app-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.imageUrl} alt="" loading="eager" />
          </div>
        ) : null}

        <h1 className="mini-app-title">{config.title || " "}</h1>

        {descLines.length > 0 ? (
          <p className="mini-app-desc">
            {descLines.map((line, i) => (
              <span key={i}>
                {line}
                {i < descLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        ) : null}

        <div className="mini-app-cta-wrap">
          <div
            className="mini-app-glow"
            aria-hidden="true"
            style={{ background: `radial-gradient(60% 60% at 50% 50%, ${hexToRgba(brand, 0.55)} 0%, ${hexToRgba(brand, 0)} 70%)` }}
          />
          <button
            type="button"
            className="mini-app-cta"
            onClick={handleCta}
            style={{
              background: brand,
              boxShadow: `0 20px 40px -12px ${hexToRgba(brand, 0.55)}, 0 6px 16px -6px ${hexToRgba(brand, 0.4)}`,
            }}
          >
            {config.ctaText || "Открыть"}
          </button>
        </div>

        {!preview ? (
          <footer className="mini-app-footer">Powered by Maxiflow</footer>
        ) : null}
      </main>
    </div>
  );
}

const CSS = `
.mini-app-root {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.mini-app-dark { color: #ffffff; }
.mini-app-light { color: #15141C; }

.mini-app-noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.04;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

.mini-app-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  gap: 20px;
}

.mini-app-hero {
  width: 100%;
  aspect-ratio: 1.6 / 1;
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 24px 48px -20px rgba(0, 0, 0, 0.5);
}
.mini-app-light .mini-app-hero {
  background: rgba(21, 20, 28, 0.04);
  box-shadow: 0 20px 48px -24px rgba(21, 20, 28, 0.25);
}
.mini-app-hero img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-app-title {
  margin: 4px 0 0;
  font-size: 34px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.02em;
}
@media (max-width: 380px) {
  .mini-app-title { font-size: 30px; }
}

.mini-app-desc {
  margin: 0;
  font-size: 17px;
  line-height: 1.5;
  opacity: 0.75;
}

.mini-app-cta-wrap {
  position: relative;
  margin-top: 8px;
  isolation: isolate;
}
.mini-app-glow {
  position: absolute;
  z-index: -1;
  inset: -40px -20px;
  filter: blur(24px);
  pointer-events: none;
}

.mini-app-cta {
  appearance: none;
  border: 0;
  width: 100%;
  min-height: 56px;
  padding: 18px 32px;
  border-radius: 16px;
  color: #ffffff;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.005em;
  cursor: pointer;
  transition: transform 120ms ease, filter 120ms ease;
  will-change: transform;
}
.mini-app-cta:hover { filter: brightness(1.05); }
.mini-app-cta:active { transform: scale(0.98); }
.mini-app-cta:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.8);
  outline-offset: 3px;
}
.mini-app-light .mini-app-cta:focus-visible {
  outline-color: rgba(21, 20, 28, 0.7);
}

.mini-app-footer {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  opacity: 0.4;
  letter-spacing: 0.01em;
}
`;
