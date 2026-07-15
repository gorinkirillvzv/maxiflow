// Каскад — icon set, 24px viewBox. Портировано из lib/icons.jsx
import type { CSSProperties } from "react";

const PATHS: Record<string, string> = {
  dashboard:  "M3 12h7V3H3v9zm0 9h7v-6H3v6zm11 0h7V12h-7v9zm0-18v6h7V3h-7z",
  channel:    "M4 4h11l5 5v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 11l4 3-4 3v-6z",
  funnel:     "M3 5h18l-7 8v6l-4 2v-8L3 5z",
  bot:        "M12 2v3 M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z M9 13h.01 M15 13h.01 M9 17h6",
  post:       "M4 4h12l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 12h8 M8 16h5",
  magnet:     "M6 3v8a6 6 0 0 0 12 0V3 M6 3h4 M14 3h4 M6 11h4 M14 11h4",
  segment:    "M12 2a10 10 0 0 1 10 10h-10V2z M12 4v8H4a8 8 0 0 1 8-8z M4 12a8 8 0 0 0 16 0",
  broadcast:  "M3 11a9 9 0 0 1 18 0 M6 11a6 6 0 0 1 12 0 M9 11a3 3 0 0 1 6 0 M12 11v10 M9 21h6",
  analytics:  "M3 3v18h18 M7 14l4-4 4 4 5-6",
  abtest:     "M9 3v18 M3 9h18 M3 15h18 M15 3v18",
  billing:    "M2 7h20v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z M2 11h20 M6 17h4",
  search:     "M11 4a7 7 0 1 1-7 7 7 7 0 0 1 7-7zM21 21l-5-5",
  bell:       "M6 11a6 6 0 0 1 12 0c0 7 2 7 2 7H4s2 0 2-7z M9 19a3 3 0 0 0 6 0",
  plus:       "M12 5v14 M5 12h14",
  minus:      "M5 12h14",
  settings_h: "M4 6h16 M4 12h10 M4 18h16 M17 9v6 M17 11l2 1-2 1",
  check:      "M5 13l4 4L19 7",
  chevron_d:  "M6 9l6 6 6-6",
  chevron_r:  "M9 6l6 6-6 6",
  close:      "M6 6l12 12 M18 6l-12 12",
  sparkles:   "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z M19 14l.8 2.2 2.2.8-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z",
  arrow_r:    "M5 12h14 M13 5l7 7-7 7",
  arrow_dr:   "M7 7h10v10 M7 17 17 7",
  filter:     "M3 5h18 M6 12h12 M10 19h4",
  calendar:   "M4 6h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z M4 10h16 M8 3v4 M16 3v4",
  download:   "M12 4v12 M6 10l6 6 6-6 M4 20h16",
  upload:     "M12 20V8 M6 14l6-6 6 6 M4 4h16",
  copy:       "M8 8h10v12H8z M5 5h10v3 M5 5v10h3",
  link:       "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1 M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  more:       "M5 12h.01 M12 12h.01 M19 12h.01",
  drag:       "M9 6h.01 M9 12h.01 M9 18h.01 M15 6h.01 M15 12h.01 M15 18h.01",
  bolt:       "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  trash:      "M4 7h16 M9 7V4h6v3 M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13",
  eye:        "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  user:       "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  users:      "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M3 21a6 6 0 0 1 12 0 M17 11a4 4 0 0 0 0-8 M22 21a6 6 0 0 0-5-5.9",
  tag:        "M3 12 12 3h9v9l-9 9-9-9z M7 7h.01",
  edit:       "M4 20h4l11-11-4-4L4 16v4z M14 6l4 4",
  layers:     "M12 2 2 7l10 5 10-5-10-5z M2 12l10 5 10-5 M2 17l10 5 10-5",
  image:      "M4 4h16v16H4z M4 16l5-5 4 4 3-3 4 4 M16 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2z",
  video:      "M4 5h12v14H4z M16 9l4-3v12l-4-3z",
  file:       "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6",
  emoji:      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01",
  zap:        "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  rocket:     "M5 19c0-7 7-14 14-14 0 7-7 14-14 14z M5 19c-1 0-2 1-2 3 2 0 3-1 3-2 M14 10a2 2 0 1 0-2-2",
  shield:     "M12 2 4 6v6c0 5 4 9 8 10 4-1 8-5 8-10V6l-8-4z M9 12l2 2 4-4",
  globe:      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2c3 3 5 7 5 10s-2 7-5 10c-3-3-5-7-5-10s2-7 5-10z",
  settings:   "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.15.69.41.93.74L21 9a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  ruble:      "M7 4h6a4 4 0 0 1 0 8H7 M7 4v16 M5 12h8 M5 16h6",
  trend_up:   "M3 17l6-6 4 4 8-8 M21 7v6h-6",
  trend_dn:   "M3 7l6 6 4-4 8 8 M21 17v-6h-6",
  smile:      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 14s1 2 3 2 3-2 3-2 M9 9h.01 M15 9h.01",
  yandex:     "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M14.5 7h-2.3c-1.6 0-2.6 1-2.6 2.4 0 1.2.6 1.8 1.5 2.3l-2.6 4.6h1.7l2.4-4.2h1l-.1 4.2h1.5V7h-.5z",
  max:        "M3 20V4l9 11L21 4v16",
  list:       "M4 6h16 M4 12h16 M4 18h12",
  menu:       "M4 6h16 M4 12h16 M4 18h16",
  grid:       "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  play:       "M6 4l14 8L6 20V4z",
  pause:      "M6 4h4v16H6z M14 4h4v16h-4z",
  pin:        "M12 2v8 M8 10h8l-1 6h-6l-1-6z M12 16v6",
  flame:      "M12 2c0 4-4 5-4 9a4 4 0 0 0 8 0c0-2-1-3-1-4 0-1 1-2 1-2s2 3 2 6a6 6 0 0 1-12 0c0-6 6-6 6-9z",
  heart:      "M12 21s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12z",
  send:       "M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7z",
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  stroke = "currentColor",
  fill = "none",
  strokeWidth = 1.7,
  style,
}: {
  name: string;
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}
