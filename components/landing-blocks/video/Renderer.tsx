// Public renderer for the "video" landing block.
//
// Accepts a URL from YouTube or VK Видео and emits a responsive 16:9 iframe.
// Kept server-safe: no hooks, no browser-only APIs, no `use client`. It may still
// be included by BlockRenderer (which is a client component) — nothing in this
// file touches the DOM, so the bundle stays lean either way.
//
// Provider detection strategy:
//   1) If `data.provider` is "youtube" or "vk", we only try that parser.
//   2) If it's "auto", we try YouTube first (most common), then VK.
// A bare 11-char YouTube id is also accepted, in case the user pastes one.
// Everything else falls back to a friendly placeholder so a broken landing
// still renders (see BlockRenderer's contract).
import type { VideoData } from "@/lib/landing-blocks/types";

/** Extract a YouTube video id from any of the URL shapes users typically paste. */
function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare id — 11 chars, [A-Za-z0-9_-].
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") {
      const v = u.searchParams.get("v");
      return v && /^[a-zA-Z0-9_-]{6,}$/.test(v) ? v : null;
    }
    // /embed/ID, /shorts/ID, /v/ID, /live/ID
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && ["embed", "shorts", "v", "live"].includes(parts[0])) {
      const id = parts[1];
      return /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
    }
  }

  return null;
}

/** Build a VK embed URL from either a watch link or an existing embed link. */
function parseVkEmbed(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const isVk =
    host === "vk.com" ||
    host === "m.vk.com" ||
    host === "vkvideo.ru" ||
    host === "m.vkvideo.ru";
  if (!isVk) return null;

  // Already an embed URL — pass through untouched (hash matters for private clips).
  if (u.pathname === "/video_ext.php") {
    // Force https so mixed-content doesn't break inside our https landing.
    return `https://vk.com${u.pathname}${u.search}`;
  }

  // Watch URL: /video-123_456 or /video123_456, optionally with a `hash` query.
  const match = u.pathname.match(/^\/video(-?\d+)_(\d+)/);
  if (!match) return null;
  const oid = match[1];
  const id = match[2];
  const hash = u.searchParams.get("hash");

  const params = new URLSearchParams({ oid, id });
  if (hash) params.set("hash", hash);
  return `https://vk.com/video_ext.php?${params.toString()}`;
}

interface Parsed {
  provider: "youtube" | "vk";
  embedUrl: string;
}

function parseVideo(data: VideoData): Parsed | null {
  const url = data.url.trim();
  if (!url) return null;

  const wantYouTube = data.provider === "youtube" || data.provider === "auto";
  const wantVk = data.provider === "vk" || data.provider === "auto";

  if (wantYouTube) {
    const id = parseYouTubeId(url);
    if (id) {
      // youtube-nocookie preserves SEO/embeds without dropping a tracking cookie
      // until the visitor hits play.
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  if (wantVk) {
    const embed = parseVkEmbed(url);
    if (embed) return { provider: "vk", embedUrl: embed };
  }

  return null;
}

export interface VideoRendererProps {
  id: string;
  data: VideoData;
}

export default function VideoRenderer({ id, data }: VideoRendererProps) {
  const parsed = parseVideo(data);
  const width = data.width === "narrow" || data.width === "full" ? data.width : "wide";
  const containerClass =
    width === "full" ? "lp-container lp-container--full" : "lp-container";

  return (
    <section className="lp-block" id={`block-${id}`}>
      <div className={containerClass}>
        <figure className={`lp-video lp-video--${width}`}>
          {parsed ? (
            <div className="lp-video__frame">
              <iframe
                className="lp-video__iframe"
                src={parsed.embedUrl}
                title={data.caption || "Видео"}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div className="lp-video__placeholder" role="note">
              {data.url
                ? "Не удалось распознать ссылку — проверьте, что это YouTube или VK Видео."
                : "Добавьте ссылку на видео с YouTube или VK Видео."}
            </div>
          )}
          {data.caption ? (
            <figcaption className="lp-video__caption">{data.caption}</figcaption>
          ) : null}
        </figure>
      </div>

      {/* Scoped styles — kept next to the renderer so the block is self-contained. */}
      <style>{`
        .lp-video {
          margin: 0 auto;
          padding: 0;
        }
        .lp-video--narrow { max-width: 480px; }
        .lp-video--wide { max-width: 100%; }
        .lp-video--full { max-width: 100%; }
        .lp-video__frame {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #000;
          border-radius: var(--lp-radius);
          overflow: hidden;
          box-shadow: var(--lp-shadow);
        }
        .lp-video--full .lp-video__frame {
          border-radius: 0;
          box-shadow: none;
        }
        .lp-video__iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
        }
        .lp-video__placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          aspect-ratio: 16 / 9;
          padding: 20px;
          background: var(--lp-surface-2);
          color: var(--lp-muted);
          border: 1px dashed var(--lp-line);
          border-radius: var(--lp-radius);
          font-size: 14px;
          line-height: 1.5;
        }
        .lp-video__caption {
          margin: 12px 0 0;
          text-align: center;
          font-size: 14px;
          line-height: 1.5;
          color: var(--lp-muted);
        }
      `}</style>
    </section>
  );
}
