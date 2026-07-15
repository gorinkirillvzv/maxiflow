"use client";

// Central dispatcher for editor panels shown in the builder's Inspector.
// Each per-type editor lives at ./<type>/Editor.tsx and receives:
//   - `data` narrowed to its own data shape,
//   - `onChange(nextData)` — same-type patch, we lift it back to a full Block here.
//
// The parent (Inspector) only knows about `Block` + `onChange(Block)`. This file
// bridges the discriminated union so per-type editors can stay strictly typed.

import type { Block, BlockByType, BlockType } from "@/lib/landing-blocks/types";

import AboutEditor from "./about/Editor";
import BotDeeplinkEditor from "./bot_deeplink/Editor";
import ButtonsGridEditor from "./buttons_grid/Editor";
import ChannelCardEditor from "./channel_card/Editor";
import CtaEditor from "./cta/Editor";
import FaqEditor from "./faq/Editor";
import FeaturesEditor from "./features/Editor";
import FooterEditor from "./footer/Editor";
import HeroEditor from "./hero/Editor";
import ImageEditor from "./image/Editor";
import QuoteEditor from "./quote/Editor";
import TextEditor from "./text/Editor";
import VideoEditor from "./video/Editor";

export interface BlockEditorProps {
  block: Block;
  onChange: (next: Block) => void;
  botId?: string;   // прокидываем в per-type Editor'ы, использующие MediaPicker (hero/image/quote/about)
}

/**
 * Small helper that produces an `onChange` callback typed to the block's own
 * data shape, so per-type editors don't have to re-narrow the union.
 */
function makeDataChangeHandler<T extends BlockType>(
  block: BlockByType[T],
  onChange: (next: Block) => void,
): (data: BlockByType[T]["data"]) => void {
  return (data) => {
    // Preserve the discriminant explicitly — TS can't infer that spreading
    // `block` keeps the union member narrow after replacing `data`.
    onChange({ ...block, data } as Block);
  };
}

export default function BlockEditor({ block, onChange, botId }: BlockEditorProps) {
  switch (block.type) {
    case "hero":
      return (
        <HeroEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
          botId={botId}
        />
      );
    case "text":
      return (
        <TextEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
        />
      );
    case "image":
      return (
        <ImageEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
          botId={botId}
        />
      );
    case "video":
      return (
        <VideoEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
        />
      );
    case "features":
      return (
        <FeaturesEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
        />
      );
    case "quote":
      return (
        <QuoteEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
          botId={botId}
        />
      );
    case "faq":
      return (
        <FaqEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
        />
      );
    case "about":
      return (
        <AboutEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
          botId={botId}
        />
      );
    case "cta":
      return (
        <CtaEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
        />
      );
    case "footer":
      return (
        <FooterEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
        />
      );
    case "buttons_grid":
      return (
        <ButtonsGridEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
          botId={botId}
        />
      );
    case "channel_card":
      return (
        <ChannelCardEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
          botId={botId}
        />
      );
    case "bot_deeplink":
      return (
        <BotDeeplinkEditor
          data={block.data}
          onChange={makeDataChangeHandler(block, onChange)}
          botId={botId}
        />
      );
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}
