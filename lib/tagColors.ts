// Maxiflow — палитра цветов тегов. Используется и в управлении, и при показе чипов.
export const TAG_COLORS = ["violet", "amber", "green", "coral", "blue", "pink"] as const;
export type TagColor = typeof TAG_COLORS[number];

const PALETTE: Record<string, { bg: string; fg: string }> = {
  violet: { bg: "var(--brand-violet-12)", fg: "var(--brand-violet-pressed)" },
  amber:  { bg: "var(--brand-amber-12)",  fg: "#8A5A00" },
  green:  { bg: "var(--success-12)",      fg: "#0A7A3C" },
  coral:  { bg: "var(--brand-coral-12)",  fg: "#B12E1A" },
  blue:   { bg: "#DBEAFE",                fg: "#1E40AF" },
  pink:   { bg: "#FCE7F3",                fg: "#9F1239" },
};

export function tagStyle(color: string): { background: string; color: string } {
  const p = PALETTE[color] ?? PALETTE.violet;
  return { background: p.bg, color: p.fg };
}
