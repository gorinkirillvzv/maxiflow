"use client";
// Maxiflow — WYSIWYG-редактор для MAX-постов. Хранение: MAX-markdown
// (**жирный**, _курсив_, ++подчёркнутый++, ~~зачёркнутый~~, `моно`, [текст](url)).
// Отображение: contentEditable с реальным форматированием. Парсер двусторонний.
import { useRef, useState, useEffect } from "react";
import { Icon } from "./Icon";

const EMOJI = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😎", "🤩", "🥳", "😉",
  "🙂", "😇", "🤔", "😏", "😴", "🙃", "😢", "😡", "🥺", "😱",
  "👍", "👎", "👏", "🙌", "🤝", "💪", "🙏", "👌", "✌️", "🫶",
  "✅", "❌", "⚠️", "🔥", "✨", "⭐", "🌟", "💡", "🎯", "🎁",
  "🎉", "🎊", "🚀", "💎", "📈", "📉", "📊", "💰", "💸", "🏆",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "💯", "❗", "❓", "‼️",
  "📌", "📍", "🔔", "📢", "📣", "👀", "💬", "✍️", "📝", "📅",
  "⏰", "⏳", "🆕", "🆓", "💥", "🤖", "📲", "🔗", "👇", "👆",
];

type Props = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// MAX-markdown → HTML для contentEditable.
// Обрабатываем построчно, чтобы переводы корректно превратились в <br>.
function markdownToHtml(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  const htmlLines = lines.map((line) => renderLine(line));
  return htmlLines.join("<br>");
}

function renderLine(src: string): string {
  // Сначала экранируем спецсимволы, потом восстанавливаем известные markdown-паттерны.
  let s = escapeHtml(src);

  // [text](url) — ссылки. URL может содержать &amp; после экранирования.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const url = String(u).replace(/&amp;/g, "&");
    return `<a href="${escapeHtml(url)}">${t}</a>`;
  });
  // **bold**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  // ++underline++
  s = s.replace(/\+\+([^+\n]+)\+\+/g, "<u>$1</u>");
  // ~~strike~~
  s = s.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  // _italic_ — только когда символ снаружи не буква/цифра, чтобы не ломать snake_case
  s = s.replace(/(^|[^\w<])_([^_\n<]+)_(?=$|[^\w>])/g, "$1<i>$2</i>");
  // `code`
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  return s;
}

// HTML из contentEditable → MAX-markdown.
function htmlToMarkdown(root: HTMLElement): string {
  const out: string[] = [];

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const style = el.style;

    if (tag === "br") { out.push("\n"); return; }

    const block = ["div", "p", "li", "h1", "h2", "h3", "h4", "blockquote"].includes(tag);
    if (block && out.length && !out[out.length - 1].endsWith("\n")) out.push("\n");
    if (tag === "li") out.push("• ");

    // Ссылка — целиком как [text](href), без рекурсии.
    if (tag === "a") {
      const href = (el as HTMLAnchorElement).getAttribute("href") || "";
      const text = el.textContent || href;
      out.push(`[${text}](${href})`);
      if (block) out.push("\n");
      return;
    }

    const isBold = tag === "b" || tag === "strong" ||
      /(?:^|;)\s*font-weight\s*:\s*(?:bold|[6-9]00)/.test(style.cssText);
    const isItalic = tag === "i" || tag === "em" ||
      /(?:^|;)\s*font-style\s*:\s*italic/.test(style.cssText);
    const isUnderline = tag === "u" ||
      /text-decoration[^;]*underline/.test(style.cssText);
    const isStrike = tag === "s" || tag === "strike" || tag === "del" ||
      /text-decoration[^;]*line-through/.test(style.cssText);
    const isCode = tag === "code" || tag === "kbd";

    const open: string[] = [];
    const close: string[] = [];
    if (isCode)      { open.push("`");  close.unshift("`");  }
    if (isBold)      { open.push("**"); close.unshift("**"); }
    if (isItalic)    { open.push("_");  close.unshift("_");  }
    if (isUnderline) { open.push("++"); close.unshift("++"); }
    if (isStrike)    { open.push("~~"); close.unshift("~~"); }

    if (open.length) {
      // Собираем содержимое элемента в отдельный буфер, чтобы обернуть каждую строку
      // маркерами отдельно. Иначе MAX видит `**` в начале одной строки и в конце другой
      // и не считает это одной bold-областью — маркеры вываливаются как plain-текст.
      const inner: string[] = [];
      const outerOut = out;
      const swap = out.splice(0, out.length);      // временно обнуляем out
      el.childNodes.forEach(walk);
      inner.push(...out.splice(0, out.length));
      outerOut.push(...swap);                       // возвращаем внешний контент
      const raw = inner.join("");
      const o = open.join("");
      const c = close.join("");
      // построчно оборачиваем непустые сегменты; переносы строк и whitespace оставляем как есть
      const wrapped = raw.split("\n").map((line) => {
        const trimmed = line.trim();
        return trimmed ? o + line + c : line;
      }).join("\n");
      outerOut.push(wrapped);
    } else {
      el.childNodes.forEach(walk);
    }

    if (block) out.push("\n");
  };

  root.childNodes.forEach(walk);

  return out.join("")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

export function RichTextField({ value, onChange, rows = 5, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>(value);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // sync извне (например, загрузили другой пост на редактирование)
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    ed.innerHTML = markdownToHtml(value);
  }, [value]);

  // первая инициализация
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.innerHTML = markdownToHtml(value);
    lastValueRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncOut() {
    const ed = editorRef.current;
    if (!ed) return;
    const md = htmlToMarkdown(ed);
    lastValueRef.current = md;
    onChange(md);
  }

  function applyCmd(cmd: "bold" | "italic" | "underline" | "strikeThrough") {
    editorRef.current?.focus();
    document.execCommand(cmd);
    syncOut();
  }

  function applyCode() {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const code = document.createElement("code");
    try {
      code.appendChild(range.extractContents());
      range.insertNode(code);
      const after = document.createRange();
      after.setStartAfter(code);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    } catch { /* ignore */ }
    syncOut();
  }

  function insertLink() {
    const ed = editorRef.current;
    if (!ed) return;
    const url = window.prompt("Адрес ссылки:", "https://");
    if (!url || !url.trim()) return;
    ed.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const text = range.toString() || "ссылка";
    const a = document.createElement("a");
    a.href = url.trim();
    a.textContent = text;
    range.deleteContents();
    range.insertNode(a);
    const after = document.createRange();
    after.setStartAfter(a);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    syncOut();
  }

  function insertEmoji(em: string) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ed.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(em);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      ed.appendChild(document.createTextNode(em));
    }
    setEmojiOpen(false);
    syncOut();
  }

  // Вставка из буфера: даём браузеру обработать (он сохранит форматирование
  // в виде HTML), затем onInput пересоберёт markdown через htmlToMarkdown.
  // Только plain text вставляем сами — execCommand fallback.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const cd = e.clipboardData;
    if (!cd) return;
    const html = cd.getData("text/html");
    if (html) return; // браузер вставит HTML, дальше onInput
    // plain text — вставим без браузерного дефолта, чтобы не превращалось в <div>
    e.preventDefault();
    const text = cd.getData("text/plain");
    if (!text) return;
    document.execCommand("insertText", false, text);
  }

  const tools: { label?: string; icon?: string; title: string; run: () => void;
                 style?: React.CSSProperties }[] = [
    { label: "Ж",  title: "Жирный",       run: () => applyCmd("bold"),          style: { fontWeight: 700 } },
    { label: "К",  title: "Курсив",       run: () => applyCmd("italic"),        style: { fontStyle: "italic" } },
    { label: "Ч",  title: "Подчёркнутый", run: () => applyCmd("underline"),     style: { textDecoration: "underline" } },
    { label: "З",  title: "Зачёркнутый",  run: () => applyCmd("strikeThrough"), style: { textDecoration: "line-through" } },
    { label: "‹›", title: "Моно",         run: applyCode },
    { icon: "link", title: "Ссылка",       run: insertLink },
  ];

  return (
    <div style={{ position: "relative" }}>
      {/* панель инструментов */}
      <div className="kk-row kk-gap-2" style={{
        flexWrap: "wrap", padding: "6px 8px", border: "1px solid var(--n-200)",
        borderBottom: 0, borderRadius: "10px 10px 0 0", background: "var(--n-25)",
      }}>
        {tools.map((t, i) => (
          <button key={i} type="button" title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
            style={{
              minWidth: 28, height: 28, padding: "0 7px", border: "1px solid var(--n-200)",
              borderRadius: 7, background: "var(--n-0)", cursor: "pointer",
              fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center",
              ...(t.style || {}),
            }}>
            {t.icon ? <Icon name={t.icon} size={14} /> : t.label}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: "var(--n-200)", margin: "0 2px" }} />
        <button type="button" title="Эмодзи" onMouseDown={(e) => e.preventDefault()}
          onClick={() => setEmojiOpen((v) => !v)}
          style={{
            minWidth: 28, height: 28, padding: "0 7px", border: "1px solid var(--n-200)",
            borderRadius: 7, background: emojiOpen ? "var(--brand-violet-12)" : "var(--n-0)",
            cursor: "pointer", fontSize: 15, display: "grid", placeItems: "center",
          }}>
          😊
        </button>
      </div>

      {/* редактируемая область */}
      <div
        ref={editorRef}
        className="kk-rich"
        contentEditable
        suppressContentEditableWarning
        onInput={syncOut}
        onPaste={onPaste}
        data-placeholder={placeholder || ""}
        style={{ minHeight: rows * 24 }}
      />

      {/* эмодзи-попап */}
      {emojiOpen && (
        <>
          <div onClick={() => setEmojiOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div className="kk-scroll" style={{
            position: "absolute", top: 40, left: 8, zIndex: 50,
            width: 296, maxHeight: 196, overflowY: "auto", padding: 8,
            background: "var(--n-0)", borderRadius: 12, boxShadow: "var(--shadow-pop)",
            display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2,
          }}>
            {EMOJI.map((em) => (
              <button key={em} type="button" onClick={() => insertEmoji(em)}
                style={{
                  height: 32, border: 0, background: "transparent", cursor: "pointer",
                  fontSize: 19, borderRadius: 7,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--n-100)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                {em}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
