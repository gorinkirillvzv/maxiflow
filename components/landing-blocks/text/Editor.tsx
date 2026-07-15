"use client";

// Inspector panel for the `text` block. Delegates the actual markdown editing
// to RichTextField — the same WYSIWYG we use across the admin for MAX posts,
// so authors don't have to learn two syntaxes. Everything else on this panel
// is a thin wrapper around align selection.

import type { TextAlign, TextData } from "@/lib/landing-blocks/types";
import { RichTextField } from "@/components/RichTextField";

export interface TextEditorProps {
  data: TextData;
  onChange: (data: TextData) => void;
}

const ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: "left", label: "По левому краю" },
  { value: "center", label: "По центру" },
  { value: "right", label: "По правому краю" },
];

export default function TextEditor({ data, onChange }: TextEditorProps) {
  const setMarkdown = (markdown: string) => onChange({ ...data, markdown });
  const setAlign = (align: TextAlign) => onChange({ ...data, align });

  return (
    <div className="kk-col kk-gap-3">
      <div className="kk-col kk-gap-1">
        <label className="kk-label" htmlFor="text-block-markdown">
          Текст
        </label>
        <RichTextField
          value={data.markdown}
          onChange={setMarkdown}
          rows={8}
          placeholder="Напишите абзац. Выделяйте важное жирным, ставьте _курсив_ и добавляйте ссылки."
        />
        <div className="kk-xs kk-muted" style={{ lineHeight: 1.5 }}>
          Пустая строка — новый абзац. Строка, начинающаяся с
          <code style={{ margin: "0 4px" }}>- </code>
          или
          <code style={{ margin: "0 4px" }}>* </code>
          — пункт списка.
        </div>
      </div>

      <div className="kk-col kk-gap-1">
        <label className="kk-label" htmlFor="text-block-align">
          Выравнивание
        </label>
        <select
          id="text-block-align"
          className="kk-input"
          value={data.align}
          onChange={(e) => setAlign(e.target.value as TextAlign)}
        >
          {ALIGN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
