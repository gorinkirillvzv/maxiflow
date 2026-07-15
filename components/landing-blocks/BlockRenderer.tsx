// Central dispatcher that picks the correct per-type renderer for a block.
// Server-safe: не помечен "use client", чтобы публичный /lp/[slug] рендерился на сервере.
// В редакторе не используется — там сидит BlockEditor.
//
// Each per-type renderer lives at ./<type>/Renderer.tsx and receives a
// discriminant-narrowed `data` prop plus its `id`. Unknown block types render
// nothing (defensive — protects public pages from bad rows in the DB).

import type { Block } from "@/lib/landing-blocks/types";

import AboutRenderer from "./about/Renderer";
import BotDeeplinkRenderer from "./bot_deeplink/Renderer";
import ButtonsGridRenderer from "./buttons_grid/Renderer";
import ChannelCardRenderer from "./channel_card/Renderer";
import CtaRenderer from "./cta/Renderer";
import FaqRenderer from "./faq/Renderer";
import FeaturesRenderer from "./features/Renderer";
import FooterRenderer from "./footer/Renderer";
import HeroRenderer from "./hero/Renderer";
import ImageRenderer from "./image/Renderer";
import QuoteRenderer from "./quote/Renderer";
import TextRenderer from "./text/Renderer";
import VideoRenderer from "./video/Renderer";

export interface BlockRendererProps {
  block: Block;
  /** Landing id — needed by CTA / hero renderers for the /api/landings/event ping. */
  landingId?: string;
  /** Bot uuid — прокидываем в mini-app блоки (channel_card дёргает /api/mini/subscribe). */
  botId?: string;
  /** username бота (без @) — для bot_deeplink и потенциального fallback в channel_card. */
  botUsername?: string;
  /** id канала — для будущих блоков, пока не используется, но принимается для симметрии. */
  channelId?: string;
}

export default function BlockRenderer({
  block,
  landingId,
  botId,
  botUsername,
  channelId,
}: BlockRendererProps) {
  switch (block.type) {
    case "hero":
      return <HeroRenderer id={block.id} data={block.data} landingId={landingId} />;
    case "text":
      return <TextRenderer id={block.id} data={block.data} />;
    case "image":
      return <ImageRenderer id={block.id} data={block.data} />;
    case "video":
      return <VideoRenderer id={block.id} data={block.data} />;
    case "features":
      return <FeaturesRenderer id={block.id} data={block.data} />;
    case "quote":
      return <QuoteRenderer id={block.id} data={block.data} />;
    case "faq":
      return <FaqRenderer id={block.id} data={block.data} />;
    case "about":
      return <AboutRenderer id={block.id} data={block.data} />;
    case "cta":
      return <CtaRenderer id={block.id} data={block.data} landingId={landingId} />;
    case "footer":
      return <FooterRenderer id={block.id} data={block.data} />;
    case "buttons_grid":
      return <ButtonsGridRenderer id={block.id} data={block.data} />;
    case "channel_card":
      return (
        <ChannelCardRenderer
          id={block.id}
          data={block.data}
          botId={botId}
          botUsername={botUsername}
          channelId={channelId}
        />
      );
    case "bot_deeplink":
      return (
        <BotDeeplinkRenderer id={block.id} data={block.data} botUsername={botUsername} />
      );
    default: {
      // Exhaustiveness guard — TypeScript will error here if a new block type
      // is added to the union and this switch isn't updated.
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

/** Convenience: render an ordered list of blocks. */
export function BlockList({
  blocks,
  landingId,
  botId,
  botUsername,
  channelId,
}: {
  blocks: Block[];
  landingId?: string;
  botId?: string;
  botUsername?: string;
  channelId?: string;
}) {
  return (
    <>
      {blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          landingId={landingId}
          botId={botId}
          botUsername={botUsername}
          channelId={channelId}
        />
      ))}
    </>
  );
}
