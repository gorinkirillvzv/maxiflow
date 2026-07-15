"use client";

// Inspector panel for the "footer" block.
// Pure form — one input per field, no live preview here (BlockRenderer runs
// separately). Every field maps 1:1 to `FooterData`; we never mutate the
// incoming `data` object, always `onChange({ ...data, field: value })`.

import type { FooterData } from "@/lib/landing-blocks/types";

export interface FooterEditorProps {
  data: FooterData;
  onChange: (data: FooterData) => void;
  /** Unused by footer today — accepted so the shared editor signature holds. */
  botId?: string;
}

export default function FooterEditor({ data, onChange }: FooterEditorProps) {
  /** Patch a single field on the block's data, preserving the rest. */
  function patch<K extends keyof FooterData>(key: K, value: FooterData[K]) {
    onChange({ ...data, [key]: value });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="kk-label" htmlFor="footer-legalName">
          Юр. название
        </label>
        <input
          id="footer-legalName"
          className="kk-input"
          type="text"
          value={data.legalName}
          onChange={(e) => patch("legalName", e.target.value)}
          placeholder="ИП Иванов И. И. / ООО «Ромашка»"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="kk-label" htmlFor="footer-legalId">
          ИНН / ОГРН
        </label>
        <input
          id="footer-legalId"
          className="kk-input"
          type="text"
          value={data.legalId}
          onChange={(e) => patch("legalId", e.target.value)}
          placeholder="ИНН 0000000000"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="kk-label" htmlFor="footer-phone">
          Телефон
        </label>
        <input
          id="footer-phone"
          className="kk-input"
          type="tel"
          value={data.phone}
          onChange={(e) => patch("phone", e.target.value)}
          placeholder="+7 (000) 000-00-00"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="kk-label" htmlFor="footer-email">
          Email
        </label>
        <input
          id="footer-email"
          className="kk-input"
          type="email"
          value={data.email}
          onChange={(e) => patch("email", e.target.value)}
          placeholder="hello@example.ru"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="kk-label" htmlFor="footer-policyUrl">
          Ссылка на политику
        </label>
        <input
          id="footer-policyUrl"
          className="kk-input"
          type="url"
          value={data.policyUrl}
          onChange={(e) => patch("policyUrl", e.target.value)}
          placeholder="https://example.ru/privacy"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="kk-label" htmlFor="footer-policyLabel">
          Текст ссылки на политику
        </label>
        <input
          id="footer-policyLabel"
          className="kk-input"
          type="text"
          value={data.policyLabel}
          onChange={(e) => patch("policyLabel", e.target.value)}
          placeholder="Политика конфиденциальности"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="kk-label" htmlFor="footer-disclaimer">
          Дисклеймер / мелкий шрифт
        </label>
        <textarea
          id="footer-disclaimer"
          className="kk-input"
          value={data.disclaimer}
          onChange={(e) => patch("disclaimer", e.target.value)}
          rows={3}
          style={{ height: "auto", padding: "10px 12px", lineHeight: 1.45, resize: "vertical" }}
          placeholder="Информация на сайте не является публичной офертой…"
        />
      </div>
    </div>
  );
}
