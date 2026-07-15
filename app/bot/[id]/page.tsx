"use client";
// Maxiflow — конструктор воронки: визуальный редактор графа.
// Узлы: start, message, buttons, condition, subscribe_gate, magnet, delay.
// Связи имеют порт — у узла может быть несколько выходов (кнопки, да/нет).
import { useCallback, useEffect, useRef, useState, type PointerEvent as RP, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { RichTextField } from "@/components/RichTextField";
import { MediaPicker } from "@/components/MediaPicker";

type NodeKind = "start" | "message" | "buttons" | "condition" | "subscribe_gate" | "magnet" | "delay" | "media";
type DelayUnit = "sec" | "min" | "hour" | "day";
type ConditionKind = "subscribed" | "magnet_sent" | "from_ads";
type MediaKind = "image" | "video" | "audio" | "video_note" | "file" | "sticker";
type FButton = { id: string; text: string };
type DelayMode = "relative" | "schedule";
type FNode = {
  id: string; type: NodeKind; x: number; y: number; title: string; text: string;
  delayValue?: number; delayUnit?: DelayUnit;
  delayMode?: DelayMode;
  delayDayOffset?: number;   // 0 = сегодня, 1 = завтра, …
  delayHour?: number;        // 0-23 (МСК)
  delayMinute?: number;      // 0-59
  buttons?: FButton[];
  condition?: ConditionKind;
  notSubscribedText?: string;
  mediaKind?: MediaKind;
  mediaToken?: string;
  mediaName?: string;
  mediaThumbnail?: string;
  waitForReply?: boolean;    // бот приостанавливает воронку до ответа подписчика
  // дожим по бездействию: если узел с кнопками — через сколько отправлять «дожимающее» сообщение
  // (по ветке порта «timeout»). 0/undefined = выключено.
  inactivityValue?: number;
  inactivityUnit?: DelayUnit;
};
type FEdge = { from: string; to: string; port?: string };

const KINDS: Record<NodeKind, { label: string; color: string; icon: string }> = {
  start:          { label: "Старт",            color: "#00B956", icon: "bolt" },
  message:        { label: "Сообщение",        color: "#5B47FB", icon: "post" },
  buttons:        { label: "Кнопки",           color: "#FFB020", icon: "list" },
  condition:      { label: "Условие",          color: "#9333EA", icon: "abtest" },
  subscribe_gate: { label: "Проверка подписки", color: "#3A78FF", icon: "shield" },
  magnet:         { label: "Выдать магнит",    color: "#FF6B57", icon: "magnet" },
  delay:          { label: "Задержка",         color: "#9D9A8E", icon: "calendar" },
  media:          { label: "Медиа",            color: "#1EC8FF", icon: "post" },
};

const MEDIA_KINDS: { value: MediaKind; label: string }[] = [
  { value: "video_note", label: "Кружок" },
  { value: "audio",      label: "Голосовое" },
  { value: "image",      label: "Картинка" },
  { value: "video",      label: "Видео" },
  { value: "file",       label: "Файл" },
  { value: "sticker",    label: "Стикер" },
];

const DELAY_UNITS: { value: DelayUnit; label: string; short: string }[] = [
  { value: "sec",  label: "секунд", short: "сек" },
  { value: "min",  label: "минут",  short: "мин" },
  { value: "hour", label: "часов",  short: "ч" },
  { value: "day",  label: "дней",   short: "дн" },
];
const COND_LABELS: Record<ConditionKind, string> = {
  subscribed:  "Подписан на канал",
  magnet_sent: "Получил лид-магнит",
  from_ads:    "Пришёл с рекламы Директа",
};

const NODE_W = 224, HEAD_H = 32, BODY_H = 44, PORT_H = 26, INPUT_Y = 52;
let _seq = 0;
const uid = () => `n${Date.now().toString(36)}${(_seq++).toString(36)}`;

type Port = { id: string; label: string; color?: string };

function nodePorts(n: FNode): Port[] {
  // rich message — если у него есть кнопки, выходов столько же сколько кнопок
  if ((n.type === "message" || n.type === "buttons") && (n.buttons?.length ?? 0) > 0) {
    const ports: Port[] = n.buttons!.map((b) => ({ id: b.id, label: b.text || "Кнопка" }));
    // если на ноде включён «дожим по бездействию» — добавляем порт timeout
    if ((n.inactivityValue ?? 0) > 0) {
      const unit = DELAY_UNITS.find((u) => u.value === (n.inactivityUnit ?? "min"))?.short ?? "мин";
      ports.push({ id: "timeout", label: `не ответил ${n.inactivityValue} ${unit}`, color: "#E07B00" });
    }
    return ports;
  }
  if (n.type === "buttons") return [{ id: "out", label: "далее (нет кнопок)" }];
  if (n.type === "condition") {
    return [
      { id: "yes", label: "Да",  color: "#00B956" },
      { id: "no",  label: "Нет", color: "#E5484D" },
    ];
  }
  if (n.type === "subscribe_gate") return [{ id: "out", label: "Подписался" }];
  return [{ id: "out", label: "далее" }];
}
function nodeHeight(n: FNode): number {
  return HEAD_H + BODY_H + nodePorts(n).length * PORT_H;
}
function portY(n: FNode, portId: string): number {
  const ports = nodePorts(n);
  let idx = ports.findIndex((p) => p.id === portId);
  if (idx < 0) idx = 0;
  return HEAD_H + BODY_H + idx * PORT_H + PORT_H / 2;
}

function delayLabel(n: FNode): string {
  if (n.delayMode === "schedule") {
    const day = n.delayDayOffset ?? 0;
    const dayLabel = day === 0 ? "сегодня" : day === 1 ? "завтра" : day === 2 ? "послезавтра" : `через ${day} дн`;
    const hh = String(n.delayHour ?? 12).padStart(2, "0");
    const mm = String(n.delayMinute ?? 0).padStart(2, "0");
    return `📅 ${dayLabel} в ${hh}:${mm} МСК`;
  }
  const v = n.delayValue ?? (Number(n.text) || 0);
  const u = DELAY_UNITS.find((x) => x.value === (n.delayUnit ?? "min"));
  return `⏱ ${v} ${u?.short ?? "мин"}`;
}
function nodeSubtitle(n: FNode): string {
  if (n.type === "delay") return delayLabel(n);
  if (n.type === "condition") return COND_LABELS[n.condition ?? "subscribed"];
  if (n.type === "buttons") return n.text || `${(n.buttons ?? []).length} кнопок`;
  return n.text;
}

type FunnelMeta = {
  id: string;
  name: string;
  trigger_command: string | null;
  is_default: boolean;
  allow_restart: boolean;
  graph: { nodes: FNode[]; edges: FEdge[] } | null;
  draft_graph?: { nodes: FNode[]; edges: FEdge[] } | null;
  published_at?: string | null;
  draft_updated_at?: string | null;
};

// группы для drawer-палитры. "message" — теперь rich-блок (текст + медиа + кнопки внутри).
// Старые типы "buttons" и "media" видны только в существующих воронках, в палитре их нет.
const PALETTE_GROUPS: { label: string; items: NodeKind[] }[] = [
  { label: "Содержимое",      items: ["message"] },
  { label: "Взаимодействие",  items: ["subscribe_gate", "magnet"] },
  { label: "Логика",          items: ["condition", "delay"] },
];

function defaultGraph(): { nodes: FNode[]; edges: FEdge[] } {
  const s: FNode = { id: uid(), type: "start", x: 60, y: 200, title: "Вход в бота", text: "" };
  const g: FNode = { id: uid(), type: "subscribe_gate", x: 340, y: 200, title: "Подписка на канал", text: "Подпишись на канал и нажми кнопку." };
  const m: FNode = { id: uid(), type: "magnet", x: 620, y: 200, title: "Лид-магнит", text: "Спасибо за подписку! Держи материал." };
  return { nodes: [s, g, m], edges: [{ from: s.id, to: g.id }, { from: g.id, to: m.id }] };
}

export default function FunnelEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: funnelIdFromUrl } = use(params);
  const router = useRouter();
  const [bots, setBots] = useState<{ id: string; max_bot_username: string; channel_title: string | null }[]>([]);
  const [botId, setBotId] = useState("");
  const [funnels, setFunnels] = useState<FunnelMeta[]>([]);
  const [funnelId, setFunnelId] = useState(funnelIdFromUrl);
  const [fName, setFName] = useState("Воронка");
  const [fTrigger, setFTrigger] = useState("");
  const [fDefault, setFDefault] = useState(false);
  const [fAllowRestart, setFAllowRestart] = useState(false);
  const [nodes, setNodes] = useState<FNode[]>([]);
  const [edges, setEdges] = useState<FEdge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showFunnelSettings, setShowFunnelSettings] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  // история для undo/redo (массив снапшотов {nodes, edges})
  const history = useRef<{ nodes: FNode[]; edges: FEdge[] }[]>([]);
  const futureRef = useRef<{ nodes: FNode[]; edges: FEdge[] }[]>([]);
  const [, forceHistoryTick] = useState(0);
  const drag = useRef<{ id: string; dx: number; dy: number; startX: number; startY: number; committed: boolean } | null>(null);
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const initialLoadDone = useRef(false);
  const skipHistoryNext = useRef(false);

  const hasUnpublishedChanges = !!draftUpdatedAt && (!publishedAt || new Date(draftUpdatedAt) > new Date(publishedAt));

  function zoomIn()  { setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2))); }
  function zoomOut() { setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2))); }
  function zoomReset() { setZoom(1); }

  useEffect(() => {
    // Сначала тянем воронку по id из URL — она знает свой bot_id.
    // Это нужно потому что пользователь может открыть /bot/<funnelId> для воронки
    // НЕ активного бота — иначе loadFunnels (по «активному» botId) не найдёт её и кинет на /bot.
    Promise.all([
      fetch("/api/bots").then((r) => r.json()),
      fetch(`/api/funnel?id=${funnelIdFromUrl}`).then((r) => r.json()),
    ]).then(([botsRes, funnelRes]) => {
      const list = botsRes.bots ?? [];
      setBots(list);
      const ownerBotId = funnelRes.funnel?.bot_id;
      if (ownerBotId && list.some((b: { id: string }) => b.id === ownerBotId)) {
        setBotId(ownerBotId);
      } else if (list[0]) {
        setBotId(list[0].id);
      }
    });
  }, [funnelIdFromUrl]);

  function applyFunnel(f: FunnelMeta) {
    setFunnelId(f.id);
    // показываем draft если есть, иначе live graph
    const g = f.draft_graph ?? f.graph;
    let newNodes: FNode[]; let newEdges: FEdge[];
    if (g?.nodes?.length) {
      newNodes = g.nodes;
      newEdges = g.edges ?? [];
    } else {
      const def = defaultGraph();
      newNodes = def.nodes;
      newEdges = def.edges;
    }
    setNodes(newNodes);
    setEdges(newEdges);
    setFName(f.name);
    setFTrigger(f.trigger_command ?? "");
    setFDefault(f.is_default);
    setFAllowRestart(f.allow_restart ?? false);
    setPublishedAt(f.published_at ?? null);
    setDraftUpdatedAt(f.draft_updated_at ?? null);
    setSelected(null);
    setConnectFrom(null);
    // история стартует с initial snapshot
    history.current = [{ nodes: newNodes, edges: newEdges }];
    futureRef.current = [];
    forceHistoryTick((t) => t + 1);
    // отмечаем что изначальная загрузка прошла на следующем тике —
    // чтобы autosave не сработал от первичного setNodes/setEdges
    setTimeout(() => { initialLoadDone.current = true; }, 50);
  }

  const loadFunnels = useCallback(async (bid: string) => {
    const list: FunnelMeta[] = (await fetch(`/api/funnel?bot_id=${bid}`).then((r) => r.json())).funnels ?? [];
    setFunnels(list);
    const target = list.find((f) => f.id === funnelIdFromUrl);
    if (target) applyFunnel(target);
    else router.replace("/bot");  // воронка не найдена → обратно к списку
  }, [funnelIdFromUrl, router]);
  useEffect(() => { if (botId) loadFunnels(botId); }, [botId, loadFunnels]);

  async function deleteFunnel() {
    if (!funnelId) return;
    if (!window.confirm("Удалить эту воронку? Лиды останутся, но эта точка входа исчезнет.")) return;
    await fetch(`/api/funnel?id=${funnelId}`, { method: "DELETE" });
    router.push("/bot");
  }

  // перетаскивание с порогом: движение < 6px = тап (выделение), ≥ 6px = drag.
  // Двойной тап по ноде = «режим редактирования» — скроллим к панели инспектора.
  const DRAG_THRESHOLD = 6;
  const DOUBLE_TAP_MS = 350;
  function onNodePointerDown(e: RP, n: FNode) {
    if (connectFrom) return;
    e.stopPropagation();
    drag.current = {
      id: n.id,
      dx: e.clientX / zoom - n.x, dy: e.clientY / zoom - n.y,
      startX: e.clientX, startY: e.clientY, committed: false,
    };
    setSelected(n.id);
  }
  function onCanvasPointerMove(e: RP) {
    if (!drag.current) return;
    const d = drag.current;
    if (!d.committed) {
      const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
      d.committed = true;
    }
    setNodes((ns) => ns.map((n) => n.id === d.id ? { ...n, x: e.clientX / zoom - d.dx, y: e.clientY / zoom - d.dy } : n));
  }
  function onCanvasPointerUp() {
    const d = drag.current;
    if (d && !d.committed) {
      // чистый тап — обработка двойного нажатия
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && prev.id === d.id && now - prev.at < DOUBLE_TAP_MS) {
        inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        lastTap.current = null;
      } else {
        lastTap.current = { id: d.id, at: now };
      }
    }
    drag.current = null;
  }

  function addNode(type: NodeKind) {
    const n: FNode = {
      id: uid(), type,
      x: 140 + nodes.length * 26, y: 420 + (nodes.length % 3) * 24,
      title: KINDS[type].label,
      text: "",
    };
    if (type === "delay") { n.delayValue = 5; n.delayUnit = "min"; }
    if (type === "buttons") { n.buttons = [{ id: uid(), text: "Кнопка 1" }]; }
    if (type === "condition") { n.condition = "subscribed"; }
    if (type === "media") { n.mediaKind = "video_note"; }
    setNodes((ns) => [...ns, n]);
    setSelected(n.id);
  }

  function updateNode(id: string, patch: Partial<FNode>) {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, ...patch } : n));
  }

  function addButton(nodeId: string) {
    setNodes((ns) => ns.map((n) => n.id === nodeId
      ? { ...n, buttons: [...(n.buttons ?? []), { id: uid(), text: "Новая кнопка" }] }
      : n));
  }
  function removeButton(nodeId: string, btnId: string) {
    setNodes((ns) => ns.map((n) => n.id === nodeId
      ? { ...n, buttons: (n.buttons ?? []).filter((b) => b.id !== btnId) }
      : n));
    setEdges((es) => es.filter((e) => !(e.from === nodeId && e.port === btnId)));
  }

  function clickNode(id: string) {
    if (connectFrom && connectFrom.nodeId !== id) {
      setEdges((es) => {
        const filtered = es.filter(
          (e) => !(e.from === connectFrom.nodeId && (e.port || "out") === connectFrom.port),
        );
        return [...filtered, { from: connectFrom.nodeId, to: id, port: connectFrom.port }];
      });
      setConnectFrom(null);
    } else {
      setSelected(id);
    }
  }

  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
    setSelected(null);
  }

  function hasEdge(nodeId: string, portId: string) {
    return edges.some((e) => e.from === nodeId && (e.port || "out") === portId);
  }

  async function save(silent = false) {
    if (!funnelId) return;
    if (!silent) setSaving(true);
    setStatus(silent ? "Сохраняю…" : null);
    try {
      const r = await fetch("/api/funnel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: funnelId, graph: { nodes, edges },
          name: fName, trigger_command: fTrigger, is_default: fDefault,
          allow_restart: fAllowRestart,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Ошибка");
      setStatus(silent ? "Сохранено · auto" : "Сохранено");
      // Локально обновляем draft_updated_at — иначе кнопка «Опубликовать» не
      // засвечивается после автосейва (hasUnpublishedChanges остаётся false).
      setDraftUpdatedAt(new Date().toISOString());
      // обновляем список — имя/триггер/дефолт могли измениться
      const list: FunnelMeta[] = (await fetch(`/api/funnel?bot_id=${botId}`).then((x) => x.json())).funnels ?? [];
      setFunnels(list);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Ошибка");
    } finally {
      if (!silent) setSaving(false);
    }
  }

  // Auto-save: 2 сек после последнего изменения. Не срабатывает на первичной загрузке.
  useEffect(() => {
    if (!initialLoadDone.current || !funnelId) return;
    const t = setTimeout(() => { save(true); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, fName, fTrigger, fDefault, fAllowRestart, funnelId]);

  // История для undo/redo: фиксируем снимок при каждом изменении (debounce 600 мс).
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (skipHistoryNext.current) { skipHistoryNext.current = false; return; }
    const t = setTimeout(() => {
      const last = history.current[history.current.length - 1];
      const same = last && JSON.stringify(last.nodes) === JSON.stringify(nodes)
                && JSON.stringify(last.edges) === JSON.stringify(edges);
      if (same) return;
      history.current.push({ nodes, edges });
      if (history.current.length > 50) history.current.shift();
      futureRef.current = []; // новая ветка — будущее обнуляется
      forceHistoryTick((t) => t + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  function undo() {
    if (history.current.length <= 1) return;
    const current = history.current.pop()!;
    futureRef.current.push(current);
    const prev = history.current[history.current.length - 1];
    skipHistoryNext.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    forceHistoryTick((t) => t + 1);
  }
  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    history.current.push(next);
    skipHistoryNext.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    forceHistoryTick((t) => t + 1);
  }
  const canUndo = history.current.length > 1;
  const canRedo = futureRef.current.length > 0;

  // hotkeys Ctrl+Z / Ctrl+Shift+Z (Cmd на Mac)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      // не перехватываем когда юзер пишет в input/textarea/contenteditable
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publish() {
    if (!funnelId) return;
    setPublishing(true);
    setStatus(null);
    try {
      // сначала сохраняем последний draft на всякий случай
      await save(true);
      const r = await fetch("/api/funnel/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: funnelId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка");
      setPublishedAt(d.published_at);
      setStatus("✅ Опубликовано — бот применит за минуту");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setPublishing(false);
    }
  }

  const sel = nodes.find((n) => n.id === selected);

  return (
    <Shell active="bot" title={fName || "Воронка"} breadcrumbs={["Автоматизация", "Воронки", fName]} bgColor="var(--n-25)"
      rightSlot={
        <div className="kk-row kk-gap-2">
          <Link href="/bot" className="kk-btn kk-btn-ghost kk-btn-sm">
            <Icon name="arrow_l" size={14} /> К воронкам
          </Link>
          <div className="kk-row" style={{ gap: 0 }}>
            <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
              onClick={undo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
              <Icon name="arrow_l" size={14} />
            </button>
            <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
              onClick={redo} disabled={!canRedo} title="Повторить (Ctrl+Shift+Z)">
              <Icon name="arrow_r" size={14} />
            </button>
          </div>
          <button className="kk-btn kk-btn-outline kk-btn-sm"
            onClick={() => { setShowFunnelSettings((v) => !v); setSelected(null); }}>
            <Icon name="settings" size={14} /> Настройки
          </button>
          {hasUnpublishedChanges ? (
            <span className="kk-chip kk-chip-amber" style={{ height: 24, fontSize: 11 }}>● Есть несохр. правки</span>
          ) : publishedAt ? (
            <span className="kk-xs kk-muted" title={`Опубликовано: ${new Date(publishedAt).toLocaleString("ru-RU")}`}>
              ✓ Опубликовано
            </span>
          ) : null}
          {status && <span className="kk-sm kk-muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status}</span>}
          <button className="kk-btn kk-btn-accent kk-btn-sm" onClick={publish}
            disabled={publishing || !hasUnpublishedChanges}>
            {publishing ? "Публикую…" : "Опубликовать"}
          </button>
        </div>
      }>
      <div className="kk-bot-layout" style={{ display: "flex", height: "calc(100vh - 56px)" }}>

        {/* drawer-палитра — выезжает справа от floating + кнопки */}
        {paletteOpen && (
          <>
            <div onClick={() => setPaletteOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.15)" }} />
            <div onClick={(e) => e.stopPropagation()} style={{
              position: "fixed", right: 16, top: 80, zIndex: 50,
              width: 280, maxHeight: "75vh", overflowY: "auto",
              background: "var(--n-0)", borderRadius: 14, padding: 14,
              boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
              border: "1px solid var(--n-100)",
            }}>
              <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Добавить блок</div>
                <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon" onClick={() => setPaletteOpen(false)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
              {PALETTE_GROUPS.map((group) => (
                <div key={group.label} style={{ marginBottom: 10 }}>
                  <div className="kk-xs kk-muted" style={{
                    fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.04em", marginBottom: 6,
                  }}>{group.label}</div>
                  <div className="kk-col kk-gap-1">
                    {group.items.map((k) => (
                      <button key={k}
                        onClick={() => { addNode(k); setPaletteOpen(false); }}
                        className="kk-row kk-gap-2"
                        style={{
                          width: "100%", padding: "10px 12px", border: 0,
                          background: "var(--n-50)", borderRadius: 8,
                          cursor: "pointer", textAlign: "left",
                        }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: KINDS[k].color + "22", color: KINDS[k].color,
                          display: "grid", placeItems: "center",
                        }}>
                          <Icon name={KINDS[k].icon} size={14} />
                        </div>
                        <span className="kk-sm">{KINDS[k].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="kk-xs kk-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                Связать блоки: жми «+» на выходе блока, потом — на нужный блок-цель.
              </div>
            </div>
          </>
        )}

        {connectFrom && (
          <div style={{
            position: "fixed", top: 76, left: "50%", transform: "translateX(-50%)",
            zIndex: 35, padding: "8px 14px", borderRadius: 10,
            background: "var(--brand-amber-12)", color: "#8A5A00",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}>
            <div className="kk-row kk-gap-2 kk-xs">
              Выбери блок назначения…
              <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => setConnectFrom(null)}>отмена</button>
            </div>
          </div>
        )}

        {/* холст-обёртка для оверлеев (zoom, minimap) */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp}
          onClick={() => { setSelected(null); setConnectFrom(null); }}
          ref={canvasRef}
          className="kk-scroll kk-bot-canvas"
          style={{
            width: "100%", height: "100%", position: "relative", overflow: "auto",
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(21,20,28,0.07) 1px, transparent 0)",
            backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
          }}>

          <div style={{
            position: "relative", width: 1800, height: 1100,
            transform: `scale(${zoom})`, transformOrigin: "0 0",
          }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              {edges.map((e, i) => {
                const a = nodes.find((n) => n.id === e.from);
                const b = nodes.find((n) => n.id === e.to);
                if (!a || !b) return null;
                const x1 = a.x + NODE_W, y1 = a.y + portY(a, e.port || "out");
                const x2 = b.x, y2 = b.y + INPUT_Y;
                const mx = (x1 + x2) / 2;
                return <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none" stroke="var(--n-300)" strokeWidth="2" />;
              })}
            </svg>

            {nodes.map((n) => {
              const k = KINDS[n.type];
              const ports = nodePorts(n);
              const isSel = selected === n.id;
              const isConn = connectFrom?.nodeId === n.id;
              return (
                <div key={n.id}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onClick={(e) => { e.stopPropagation(); clickNode(n.id); }}
                  style={{
                    position: "absolute", left: n.x, top: n.y, width: NODE_W, minHeight: nodeHeight(n),
                    background: "var(--n-0)", borderRadius: 12, cursor: "grab",
                    boxShadow: isSel ? `0 0 0 2px ${k.color}, var(--shadow-2)`
                      : isConn ? "0 0 0 2px var(--brand-amber)" : "var(--shadow-card)",
                  }}>
                  {/* шапка */}
                  <div className="kk-row kk-gap-2" style={{ height: HEAD_H, padding: "0 10px", background: k.color + "16", borderRadius: "12px 12px 0 0" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: k.color, color: "#fff", display: "grid", placeItems: "center" }}>
                      <Icon name={k.icon} size={11} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: k.color, textTransform: "uppercase", letterSpacing: "0.03em" }}>{k.label}</span>
                  </div>
                  {/* тело */}
                  <div style={{ height: BODY_H, padding: "7px 10px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                    {nodeSubtitle(n) && <div className="kk-xs kk-muted" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nodeSubtitle(n)}</div>}
                  </div>
                  {/* порты-выходы */}
                  {ports.map((p) => (
                    <div key={p.id} style={{
                      position: "relative", height: PORT_H, display: "flex", alignItems: "center",
                      padding: "0 16px 0 10px", borderTop: "1px solid var(--n-100)",
                    }}>
                      <span style={{
                        fontSize: 11, flex: 1, fontWeight: p.color ? 600 : 500,
                        color: p.color ?? "var(--n-500)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{p.label}</span>
                      <button title="связать"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setConnectFrom({ nodeId: n.id, port: p.id }); }}
                        style={{
                          position: "absolute", right: -9, top: PORT_H / 2 - 9, width: 18, height: 18,
                          borderRadius: 99, border: `2px solid ${p.color ?? k.color}`,
                          background: hasEdge(n.id, p.id) ? (p.color ?? k.color) : "var(--n-0)",
                          color: hasEdge(n.id, p.id) ? "#fff" : (p.color ?? k.color),
                          cursor: "crosshair", padding: 0, fontSize: 11, lineHeight: 1,
                        }}>+</button>
                    </div>
                  ))}
                  {/* вход */}
                  {n.type !== "start" && (
                    <div style={{ position: "absolute", left: -5, top: INPUT_Y - 5, width: 10, height: 10, borderRadius: 99, background: k.color }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ───── floating + (открывает drawer-палитру) ───── */}
        <button onClick={(e) => { e.stopPropagation(); setPaletteOpen(true); }}
          title="Добавить блок"
          style={{
            position: "absolute", top: 14, right: 14, zIndex: 30,
            width: 48, height: 48, borderRadius: "50%", border: 0,
            background: "linear-gradient(135deg, var(--brand-violet), #7C5CFF)",
            color: "#fff", cursor: "pointer", fontSize: 26, lineHeight: 1,
            boxShadow: "0 6px 20px rgba(91, 71, 251, 0.4)",
            display: "grid", placeItems: "center",
          }}>+</button>

        {/* ───── зум-плашка ───── */}
        <div style={{
          position: "absolute", bottom: 14, left: 14, zIndex: 30,
          display: "flex", alignItems: "center", gap: 0,
          background: "var(--n-0)", borderRadius: 10, padding: 4,
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          border: "1px solid var(--n-100)",
        }}>
          <button onClick={(e) => { e.stopPropagation(); zoomOut(); }}
            title="Уменьшить (−)"
            style={{
              width: 34, height: 34, border: 0, background: "transparent",
              cursor: "pointer", borderRadius: 8, fontSize: 22, fontWeight: 500,
              color: "var(--n-600)", lineHeight: 1,
            }}>−</button>
          <button onClick={(e) => { e.stopPropagation(); zoomReset(); }}
            title="Сбросить (100%)"
            style={{
              minWidth: 52, height: 34, border: 0, background: "transparent",
              cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12,
              fontWeight: 600, color: "var(--n-600)",
            }}>{Math.round(zoom * 100)}%</button>
          <button onClick={(e) => { e.stopPropagation(); zoomIn(); }}
            title="Увеличить (+)"
            style={{
              width: 34, height: 34, border: 0, background: "transparent",
              cursor: "pointer", borderRadius: 8, fontSize: 20, fontWeight: 500,
              color: "var(--n-600)", lineHeight: 1,
            }}>+</button>
        </div>

        {/* ───── мини-карта ───── */}
        <Minimap nodes={nodes} canvasRef={canvasRef} zoom={zoom} />

        </div>

        {/* инспектор */}
        <div ref={inspectorRef} className="kk-bot-inspector" style={{ width: showFunnelSettings || sel ? 288 : 0, background: "var(--n-0)", borderLeft: showFunnelSettings || sel ? "1px solid var(--n-100)" : 0, padding: showFunnelSettings || sel ? 16 : 0, flexShrink: 0, overflowY: "auto", transition: "width .15s ease" }}>
          {sel ? (
            <>
              <div className="kk-row kk-gap-2" style={{ marginBottom: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{KINDS[sel.type].label}</span>
                {sel.type !== "start" && (
                  <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ marginLeft: "auto", color: "var(--danger)" }}
                    onClick={() => deleteNode(sel.id)}>
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>

              <label className="kk-label">Название блока</label>
              <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
                value={sel.title}
                onChange={(e) => updateNode(sel.id, { title: e.target.value })} />

              {(sel.type === "message" || sel.type === "buttons" || sel.type === "subscribe_gate" || sel.type === "magnet" || sel.type === "media") && (
                <>
                  <label className="kk-label">
                    {sel.type === "buttons" ? "Текст сообщения" : sel.type === "media" ? "Подпись (необязательно)" : "Текст"}
                  </label>
                  <div style={{ marginTop: 4 }}>
                    <RichTextField value={sel.text} rows={sel.type === "media" ? 3 : 5}
                      onChange={(v) => updateNode(sel.id, { text: v })} />
                  </div>
                </>
              )}

              {/* Кнопки — для message-блока (rich), для buttons-блока (legacy) и magnet */}
              {(sel.type === "message" || sel.type === "buttons" || sel.type === "magnet") && (
                <div style={{ marginTop: 14 }}>
                  <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <label className="kk-label" style={{ margin: 0 }}>Кнопки</label>
                    {(sel.buttons?.length ?? 0) > 0 && (
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => addButton(sel.id)}>
                        <Icon name="plus" size={11} /> Ещё
                      </button>
                    )}
                  </div>
                  {(sel.buttons?.length ?? 0) === 0 ? (
                    <button className="kk-btn kk-btn-outline kk-btn-sm" style={{ width: "100%" }}
                      onClick={() => addButton(sel.id)}>
                      <Icon name="plus" size={12} /> Добавить кнопку
                    </button>
                  ) : (
                    <div className="kk-col kk-gap-2">
                      {sel.buttons!.map((b) => (
                        <div key={b.id} className="kk-row kk-gap-2">
                          <input className="kk-input kk-btn-sm" style={{ flex: 1, minWidth: 0 }}
                            value={b.text}
                            onChange={(e) => updateNode(sel.id, {
                              buttons: sel.buttons!.map((x) => x.id === b.id ? { ...x, text: e.target.value } : x),
                            })} />
                          <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon" style={{ color: "var(--danger)" }}
                            onClick={() => removeButton(sel.id, b.id)}>
                            <Icon name="close" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(sel.buttons?.length ?? 0) > 0 && (
                    <div className="kk-xs kk-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                      У каждой кнопки свой выход — соедини с нужным блоком ветки.
                    </div>
                  )}
                </div>
              )}

              {/* Дожим по бездействию — для нод с кнопками */}
              {(sel.type === "message" || sel.type === "buttons") && (sel.buttons?.length ?? 0) > 0 && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--warning-12)", borderRadius: 8, border: "1px solid var(--warning)" }}>
                  <div className="kk-row" style={{ alignItems: "center", marginBottom: 6 }}>
                    <input type="checkbox" id={`inact-${sel.id}`}
                      checked={(sel.inactivityValue ?? 0) > 0}
                      onChange={(e) => updateNode(sel.id, e.target.checked
                        ? { inactivityValue: sel.inactivityValue || 30, inactivityUnit: sel.inactivityUnit ?? "min" }
                        : { inactivityValue: 0 })} />
                    <label htmlFor={`inact-${sel.id}`} className="kk-sm" style={{ marginLeft: 6, fontWeight: 600, cursor: "pointer", color: "#7A4A00" }}>
                      Дожимать если не ответил
                    </label>
                  </div>
                  {(sel.inactivityValue ?? 0) > 0 && (
                    <div className="kk-row kk-gap-2" style={{ marginBottom: 6 }}>
                      <input className="kk-input kk-btn-sm" type="number" min={1} style={{ width: 80 }}
                        value={sel.inactivityValue ?? 30}
                        onChange={(e) => updateNode(sel.id, { inactivityValue: Number(e.target.value) || 0 })} />
                      <select className="kk-input kk-btn-sm" style={{ flex: 1 }}
                        value={sel.inactivityUnit ?? "min"}
                        onChange={(e) => updateNode(sel.id, { inactivityUnit: e.target.value as DelayUnit })}>
                        {DELAY_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="kk-xs" style={{ lineHeight: 1.5, color: "#7A4A00" }}>
                    У ноды появится дополнительный порт «не ответил» — привяжи к нему дожимающее сообщение. Если юзер нажмёт любую кнопку — таймер отменится автоматически.
                  </div>
                </div>
              )}

              {/* Медиа — для message и устаревшего media */}
              {(sel.type === "message" || sel.type === "media") && (
                <div style={{ marginTop: 14 }}>
                  <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <label className="kk-label" style={{ margin: 0 }}>Медиа</label>
                    {sel.mediaToken && (
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--danger)" }}
                        onClick={() => updateNode(sel.id, { mediaKind: undefined, mediaToken: undefined, mediaName: undefined, mediaThumbnail: undefined })}>
                        Убрать
                      </button>
                    )}
                  </div>
                  {sel.mediaToken ? (
                    <div className="kk-card kk-pad-3 kk-row kk-gap-2" style={{ background: "var(--n-25)" }}>
                      {sel.mediaThumbnail ? (
                        <img src={sel.mediaThumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--n-100)" }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="kk-sm" style={{ fontWeight: 500 }}>
                          {sel.mediaName ?? `${sel.mediaKind} ${sel.mediaToken.slice(0, 6)}`}
                        </div>
                        <div className="kk-xs kk-muted">{sel.mediaKind}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <select className="kk-input" style={{ width: "100%", marginBottom: 6 }}
                        value={sel.mediaKind ?? "video_note"}
                        onChange={(e) => updateNode(sel.id, { mediaKind: e.target.value as MediaKind })}>
                        {MEDIA_KINDS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <MediaPicker botId={botId} kind={sel.mediaKind ?? "video_note"}
                        selectedToken={sel.mediaToken}
                        onPick={(asset) => updateNode(sel.id, {
                          mediaToken: asset.token,
                          mediaName: asset.name ?? undefined,
                          mediaThumbnail: asset.thumbnail_url ?? undefined,
                        })} />
                    </>
                  )}
                </div>
              )}

              {/* Ожидание ответа — на message и magnet (буферный шаг) */}
              {(sel.type === "message" || sel.type === "magnet") && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--n-25)", borderRadius: 8 }}>
                  <label className="kk-row kk-gap-2" style={{ cursor: "pointer" }}>
                    <input type="checkbox"
                      checked={!!sel.waitForReply}
                      onChange={(e) => updateNode(sel.id, { waitForReply: e.target.checked })} />
                    <span className="kk-sm" style={{ fontWeight: 500 }}>Ждать ответ подписчика</span>
                  </label>
                  <div className="kk-xs kk-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    Воронка остановится после отправки и продолжится только когда
                    подписчик напишет что-то в чат. Полезно для квизов и вопросов.
                  </div>
                </div>
              )}

              {sel.type === "subscribe_gate" && (
                <div style={{ marginTop: 14 }}>
                  <label className="kk-label">Текст, если не подписан</label>
                  <div style={{ marginTop: 4 }}>
                    <RichTextField
                      value={sel.notSubscribedText ?? ""}
                      rows={3}
                      placeholder="Не вижу подписки на канал. Подпишись и нажми кнопку ещё раз."
                      onChange={(v) => updateNode(sel.id, { notSubscribedText: v })} />
                  </div>
                  <div className="kk-xs kk-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    Шлётся, если пользователь жмёт «Я подписался», но проверка не нашла его в канале.
                  </div>
                </div>
              )}

              {sel.type === "condition" && (
                <div style={{ marginTop: 4 }}>
                  <label className="kk-label">Проверять</label>
                  <select className="kk-input" style={{ width: "100%", marginTop: 4 }}
                    value={sel.condition ?? "subscribed"}
                    onChange={(e) => updateNode(sel.id, { condition: e.target.value as ConditionKind })}>
                    {(Object.keys(COND_LABELS) as ConditionKind[]).map((c) => (
                      <option key={c} value={c}>{COND_LABELS[c]}</option>
                    ))}
                  </select>
                  <div className="kk-xs kk-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                    Выход «Да» — условие выполнено, «Нет» — нет. Соедини обе ветки.
                  </div>
                </div>
              )}

              {sel.type === "delay" && (
                <>
                  <label className="kk-label">Тип задержки</label>
                  <div className="kk-row" style={{ gap: 0, marginTop: 4, marginBottom: 10, border: "1px solid var(--n-200)", borderRadius: 8, overflow: "hidden" }}>
                    <button onClick={() => updateNode(sel.id, { delayMode: "relative" })}
                      style={{
                        flex: 1, padding: "8px", border: 0, cursor: "pointer", fontSize: 12,
                        background: (sel.delayMode ?? "relative") === "relative" ? "var(--brand-violet)" : "transparent",
                        color: (sel.delayMode ?? "relative") === "relative" ? "#fff" : "var(--n-600)",
                        fontWeight: 500,
                      }}>Через…</button>
                    <button onClick={() => updateNode(sel.id, { delayMode: "schedule", delayHour: sel.delayHour ?? 12, delayMinute: sel.delayMinute ?? 0, delayDayOffset: sel.delayDayOffset ?? 0 })}
                      style={{
                        flex: 1, padding: "8px", border: 0, cursor: "pointer", fontSize: 12,
                        background: sel.delayMode === "schedule" ? "var(--brand-violet)" : "transparent",
                        color: sel.delayMode === "schedule" ? "#fff" : "var(--n-600)",
                        fontWeight: 500,
                      }}>В конкретное время</button>
                  </div>

                  {(sel.delayMode ?? "relative") === "relative" ? (
                    <>
                      <label className="kk-label">Пауза перед следующим блоком</label>
                      <div className="kk-row kk-gap-2" style={{ marginTop: 4 }}>
                        <input className="kk-input" type="number" min={0} style={{ flex: 1, minWidth: 0 }}
                          value={sel.delayValue ?? Number(sel.text) ?? 0}
                          onChange={(e) => updateNode(sel.id, { delayValue: Math.max(0, Number(e.target.value)) })} />
                        <select className="kk-input" style={{ width: 116 }}
                          value={sel.delayUnit ?? "min"}
                          onChange={(e) => updateNode(sel.id, { delayUnit: e.target.value as DelayUnit })}>
                          {DELAY_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="kk-label">День</label>
                      <select className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 10 }}
                        value={sel.delayDayOffset ?? 0}
                        onChange={(e) => updateNode(sel.id, { delayDayOffset: Math.max(0, Number(e.target.value)) })}>
                        <option value={0}>Сегодня</option>
                        <option value={1}>Завтра</option>
                        <option value={2}>Послезавтра</option>
                        <option value={3}>Через 3 дня</option>
                        <option value={7}>Через неделю</option>
                        <option value={14}>Через 2 недели</option>
                      </select>
                      <label className="kk-label">Время (МСК)</label>
                      <div className="kk-row kk-gap-2" style={{ marginTop: 4 }}>
                        <select className="kk-input" style={{ flex: 1 }}
                          value={sel.delayHour ?? 12}
                          onChange={(e) => updateNode(sel.id, { delayHour: Math.max(0, Math.min(23, Number(e.target.value))) })}>
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, "0")} ч</option>
                          ))}
                        </select>
                        <select className="kk-input" style={{ flex: 1 }}
                          value={sel.delayMinute ?? 0}
                          onChange={(e) => updateNode(sel.id, { delayMinute: Math.max(0, Math.min(59, Number(e.target.value))) })}>
                          {[0, 15, 30, 45].map((m) => (
                            <option key={m} value={m}>{String(m).padStart(2, "0")} мин</option>
                          ))}
                        </select>
                      </div>
                      <div className="kk-xs kk-muted" style={{ marginTop: 8, lineHeight: 1.5, padding: "8px 10px", background: "var(--brand-violet-12)", borderRadius: 8 }}>
                        Полезно когда хочешь отправить материал «к ужину» или «утром следующего дня».
                        Если время сегодня уже прошло — отправится завтра в это же время.
                      </div>
                    </>
                  )}
                  <div className="kk-xs kk-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    Воронка остановится здесь и продолжится автоматически по таймеру.
                  </div>
                </>
              )}
            </>
          ) : showFunnelSettings ? (
            <div>
              <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Настройки воронки</div>
                <button className="kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon" onClick={() => setShowFunnelSettings(false)} title="Закрыть">
                  <Icon name="close" size={14} />
                </button>
              </div>
              <label className="kk-label">Название</label>
              <input className="kk-input" style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
                value={fName} onChange={(e) => setFName(e.target.value)} />
              <label className="kk-label">Команда запуска</label>
              <input className="kk-input" style={{ width: "100%", marginTop: 4 }}
                value={fTrigger} onChange={(e) => setFTrigger(e.target.value)}
                placeholder="например, webinar" />
              <div className="kk-xs kk-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                Ссылка входа: <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>?start={fTrigger || "команда"}</code>.
                {" "}Воронка также запустится, если пользователь напишет это слово боту.
              </div>
              <div className="kk-xs kk-muted" style={{ marginTop: 8, lineHeight: 1.5, padding: "8px 10px", background: "var(--brand-amber-12)", borderRadius: 8 }}>
                <b>Для Яндекс.Директа</b> используй ссылку через Maxiflow-редирект —
                иначе Метрика не увидит yclid и оффлайн-конверсии не сматчатся:
                <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11, wordBreak: "break-all" }}>
                  https://maxiflow.ru/r/&lt;твой_бот&gt;?yclid={"{yclid}"}&amp;c={"{campaign_id}"}{fTrigger ? `&trigger=${fTrigger}` : ""}
                </div>
                <div style={{ marginTop: 4 }}>
                  Промежуточная страница откроет Метрику с твоим счётчиком (визит с yclid зарегистрируется),
                  а потом мгновенно перебросит подписчика в MAX-бот.
                </div>
              </div>
              <label className="kk-row kk-gap-2" style={{ marginTop: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={fDefault} onChange={(e) => setFDefault(e.target.checked)} />
                <span className="kk-sm">Воронка по умолчанию</span>
              </label>
              <div className="kk-xs kk-muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
                Запускается при входе без команды или с неизвестной командой.
              </div>
              <label className="kk-row kk-gap-2" style={{ marginTop: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={fAllowRestart} onChange={(e) => setFAllowRestart(e.target.checked)} />
                <span className="kk-sm">Перезапускать на повторный /start</span>
              </label>
              <div className="kk-xs kk-muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
                Если выключено — повторный /start от того же юзера ничего не делает
                (избегает повторов welcome-сообщения). Включи если хочешь чтобы юзер
                мог пройти воронку заново.
              </div>
              <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ marginTop: 16, color: "var(--danger)" }}
                onClick={deleteFunnel}>
                <Icon name="trash" size={13} /> Удалить воронку
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

// ───────────────── Mini-map ─────────────────
// Маленькая карта-обзор: показывает все узлы графа в масштабе и
// прямоугольник текущего viewport. Клик-перетаскивание = scrollTo.
function Minimap({
  nodes, canvasRef, zoom,
}: {
  nodes: FNode[];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const W = 180, H = 110;
  const FIELD_W = 1800, FIELD_H = 1100;
  const sx = W / FIELD_W;
  const sy = H / FIELD_H;

  const [view, setView] = useState({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setView({
        x: el.scrollLeft / zoom,
        y: el.scrollTop / zoom,
        w: el.clientWidth / zoom,
        h: el.clientHeight / zoom,
      });
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [canvasRef, zoom]);

  function jump(ev: React.PointerEvent<SVGSVGElement>) {
    ev.stopPropagation();
    const svg = ev.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = (ev.clientX - rect.left) / sx;
    const py = (ev.clientY - rect.top) / sy;
    const el = canvasRef.current;
    if (!el) return;
    el.scrollTo({
      left: Math.max(0, px * zoom - el.clientWidth / 2),
      top:  Math.max(0, py * zoom - el.clientHeight / 2),
      behavior: "smooth",
    });
  }

  return (
    <div onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", bottom: 14, right: 14, zIndex: 30,
        background: "var(--n-0)", borderRadius: 10, padding: 6,
        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        border: "1px solid var(--n-100)",
      }}>
      <svg width={W} height={H} onPointerDown={jump}
        style={{ display: "block", cursor: "crosshair", background: "var(--n-25)", borderRadius: 6 }}>
        {nodes.map((n) => {
          const k = KINDS[n.type];
          return (
            <rect key={n.id}
              x={n.x * sx} y={n.y * sy}
              width={NODE_W * sx} height={28 * sy}
              fill={k.color} opacity={0.7} rx={2} />
          );
        })}
        <rect
          x={view.x * sx} y={view.y * sy}
          width={view.w * sx} height={view.h * sy}
          fill="none" stroke="var(--brand-violet)" strokeWidth={1.5} rx={2} />
      </svg>
    </div>
  );
}
