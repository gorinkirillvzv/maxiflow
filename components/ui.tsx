"use client";
// Каскад — shared UI molecules. Портировано из lib/ui.jsx
import React, { type ReactNode } from "react";
import { Icon } from "./Icon";

const bgMap: Record<string, string> = {
  violet: "var(--brand-violet-12)", amber: "var(--brand-amber-12)",
  green: "var(--success-12)", coral: "var(--brand-coral-12)",
};
const fgMap: Record<string, string> = {
  violet: "var(--brand-violet-pressed)", amber: "#8A5A00",
  green: "#0A7A3C", coral: "#B12E1A",
};

export function Stat({
  label, value, sub, trend, accent = "violet", icon,
}: {
  label: string; value: ReactNode; sub?: string; trend?: string;
  accent?: "violet" | "amber" | "green" | "coral"; icon?: string;
}) {
  return (
    <div className="kk-card kk-pad-5" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div className="kk-row" style={{ justifyContent: "space-between" }}>
        <div className="kk-row kk-gap-2 kk-sm kk-muted">
          {icon && (
            <div style={{ width: 24, height: 24, borderRadius: 7, background: bgMap[accent], color: fgMap[accent], display: "grid", placeItems: "center" }}>
              <Icon name={icon} size={14} />
            </div>
          )}
          <span>{label}</span>
        </div>
        {trend && (
          <span className="kk-chip kk-chip-green" style={{ height: 22 }}>
            <Icon name={trend.startsWith("-") || trend.startsWith("−") ? "trend_dn" : "trend_up"} size={12} />
            {trend}
          </span>
        )}
      </div>
      <div className="kk-num" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div className="kk-xs kk-muted">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, sub, action }: { children: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <div className="kk-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
      <div>
        <div className="kk-h4">{children}</div>
        {sub && <div className="kk-xs kk-muted" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ initials, color = "#5B47FB", size = 28 }: { initials: string; color?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, background: color, color: "#fff",
      display: "grid", placeItems: "center", fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
    }}>{initials}</div>
  );
}

export function MaxPhone({
  width = 280, children, channelName = "Партнёрский канал", subs = "12 412 подписчиков",
}: { width?: number; children?: ReactNode; channelName?: string; subs?: string }) {
  const height = Math.round(width * 1.95);
  return (
    <div style={{
      width, height, borderRadius: 32, padding: 10, background: "#15141C",
      boxShadow: "0 24px 48px rgba(21,20,28,0.18), 0 2px 6px rgba(21,20,28,0.12)",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", left: "50%", top: 16, transform: "translateX(-50%)",
        width: 80, height: 22, borderRadius: 16, background: "#0a0910", zIndex: 2,
      }} />
      <div style={{
        width: "100%", height: "100%", borderRadius: 24, overflow: "hidden",
        background: "#F4F4F8", display: "flex", flexDirection: "column",
      }}>
        <div style={{ height: 38, display: "flex", justifyContent: "space-between", padding: "14px 22px 0", fontSize: 12, fontWeight: 600, color: "#15141C" }}>
          <span>9:41</span>
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <svg width="14" height="10" viewBox="0 0 14 10"><path d="M0 9h2V7H0v2zm4 0h2V5H4v4zm4 0h2V3H8v6zm4 0h2V0h-2v9z" fill="#15141C" /></svg>
            <svg width="20" height="10" viewBox="0 0 20 10"><rect x="0.5" y="0.5" width="17" height="9" rx="2" stroke="#15141C" fill="none" /><rect x="2" y="2" width="14" height="6" rx="1" fill="#15141C" /><rect x="18" y="3.5" width="1.5" height="3" rx="0.5" fill="#15141C" /></svg>
          </span>
        </div>
        <div style={{ padding: "10px 14px 12px", display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #ECEAE3" }}>
          <Icon name="chevron_r" size={18} style={{ transform: "rotate(180deg)" }} stroke="#15141C" />
          <div style={{
            width: 36, height: 36, borderRadius: 99,
            background: "linear-gradient(135deg,#5B47FB,#7C5CFF)", color: "#fff",
            display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13,
          }}>К</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{channelName}</div>
            <div style={{ fontSize: 11, color: "#6F6D63" }}>{subs}</div>
          </div>
          <Icon name="more" size={20} stroke="#15141C" />
        </div>
        <div className="kk-scroll" style={{ flex: 1, overflow: "auto", padding: "12px 10px", background: "#F4F4F8" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function MaxPost({ children, time = "сейчас", views = "1.2К", reactions }: {
  children?: ReactNode; time?: string; views?: string; reactions?: ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "10px 12px 8px",
      marginBottom: 8, boxShadow: "0 1px 2px rgba(21,20,28,0.06)",
    }}>
      <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "#15141C" }}>{children}</div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, color: "#9D9A8E", fontSize: 10.5 }}>
        {reactions && (
          <span style={{ display: "inline-flex", gap: 2, alignItems: "center", padding: "2px 6px", borderRadius: 99, background: "#F4F3EF" }}>
            {reactions}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <Icon name="eye" size={11} /> {views}
        <span>· {time}</span>
      </div>
    </div>
  );
}

export function ToggleSwitch({ on, onChange, label }: { on: boolean; onChange?: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange?.(!on)} className="kk-row kk-gap-3"
      style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
      <div style={{
        width: 32, height: 18, borderRadius: 99, background: on ? "var(--brand-violet)" : "var(--n-200)",
        position: "relative", transition: "background 0.15s",
      }}>
        <div style={{
          position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 99,
          background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "left 0.15s",
        }} />
      </div>
      {label && <span className="kk-sm">{label}</span>}
    </button>
  );
}

export function ProgressBar({ value, max = 100, color = "var(--brand-violet)", height = 6 }: {
  value: number; max?: number; color?: string; height?: number;
}) {
  return (
    <div style={{ width: "100%", height, borderRadius: 99, background: "var(--n-100)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, (value / max) * 100)}%`, background: color, borderRadius: 99 }} />
    </div>
  );
}

export function Sparkline({ values, color = "var(--brand-violet)", width = 100, height = 28, area = true }: {
  values: number[]; color?: string; width?: number; height?: number; area?: boolean;
}) {
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - ((v - min) / range) * (height - 4) - 2]);
  const path = "M " + pts.map((p) => p.join(" ")).join(" L ");
  const areaPath = path + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {area && <path d={areaPath} fill={color} opacity="0.1" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
