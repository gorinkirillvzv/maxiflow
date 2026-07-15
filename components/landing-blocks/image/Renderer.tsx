// Public renderer for the "image" landing block.
// Server component — safe to render inside the RSC tree on /l/[slug] without
// hydration. Uses plain <img> (not next/image) so external CDN URLs from the
// bot media library and arbitrary URLs pasted in the editor both work without
// remote-image config gymnastics.
//
// Layout rules:
//   - width: "narrow" → capped at 480px, centered.
//   - width: "wide"   → fills the standard 720px .lp-container.
//   - width: "full"   → bleeds to page edges (.lp-block--bleed pattern).
//   - align applies to the caption; the image itself is centered inside its
//     max-width box, matching how block-level captions typically read.
//
// If the URL is empty we render nothing — an unconfigured image block should
// not leave visible whitespace on a live page.
import type { ImageData, MediaWidth, TextAlign } from "@/lib/landing-blocks/types";

export interface ImageRendererProps {
  id: string;
  data: ImageData;
}

function alignClass(align: TextAlign): string {
  switch (align) {
    case "center":
      return "lp-align-center";
    case "right":
      return "lp-align-right";
    default:
      return "lp-align-left";
  }
}

function mediaWidthClass(width: MediaWidth): string {
  switch (width) {
    case "narrow":
      return "lp-media lp-media--narrow";
    case "full":
      return "lp-media lp-media--full";
    default:
      return "lp-media lp-media--wide";
  }
}

export default function ImageRenderer({ id, data }: ImageRendererProps) {
  const url = data.url.trim();
  if (!url) return null;

  const caption = data.caption.trim();
  const alt = data.alt.trim();
  const isFull = data.width === "full";

  const figure = (
    <figure
      style={{
        margin: 0,
        // Center the narrow variant inside the container; wide/full stretch.
        maxWidth: data.width === "narrow" ? 480 : undefined,
        marginLeft: data.width === "narrow" ? "auto" : undefined,
        marginRight: data.width === "narrow" ? "auto" : undefined,
      }}
    >
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={mediaWidthClass(data.width)}
      />
      {caption ? (
        <figcaption
          className={`lp-muted ${alignClass(data.align)}`}
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            marginTop: 10,
            fontFamily: "var(--font-onest)",
            padding: isFull ? "0 20px" : undefined,
          }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );

  // Full-width variant bleeds edge-to-edge; other variants stay inside the
  // standard container so they line up with surrounding text blocks.
  if (isFull) {
    return (
      <section
        id={`block-${id}`}
        className="lp-block lp-block--bleed"
        style={{ padding: 0, margin: "40px 0" }}
      >
        {figure}
      </section>
    );
  }

  return (
    <section id={`block-${id}`} className="lp-block">
      <div className="lp-container">{figure}</div>
    </section>
  );
}
