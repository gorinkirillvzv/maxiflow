"use client";
// КАСКАД — App shell (sidebar + topbar). Портировано из lib/shell.jsx,
// навигация переведена на next/link. Адаптив: на мобиле сайдбар — выезжающее меню.
//
// Redesign 2026-07: обновлённый design system.
// • Sidebar: 240px, n-25 фон, элементы 40px / --r-md, hover n-100,
//   active violet-12 → violet-pressed (весь item, не только иконка).
// • CAPS-заголовки групп (opacity 0.5, letter-spacing 0.08em).
// • Нижняя nav (integrations/help/billing/settings) отделена тонкой линией,
//   рендерится в compact-режиме (36px). Плашка «Партнёрский канал» убрана.
// • TopBar: 56px, translucent + backdrop-blur, breadcrumbs с splitter «•»,
//   title h2 (24/700), search-заглушка с ⌘K badge, bell с dot, avatar+chevron.

import React, { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./Icon";

type NavItemDef = { id: string; icon: string; text: string; href: string; chip?: string; count?: string };

// Компактное меню в стиле Manychat: 3 смысловые группы + технический низ.
// Убраны дубли: setup/funnel/sources/campaigns/audit/support/channels/magnets
// (магниты настраиваются как узел внутри воронки, не отдельной страницей).
const NAV_GROUPS: { label: string | null; items: NavItemDef[] }[] = [
  {
    label: null,
    items: [
      { id: "dashboard",   icon: "dashboard", text: "Дашборд",     href: "/dashboard" },
      { id: "subscribers", icon: "users",     text: "Подписчики",  href: "/subscribers" },
      { id: "chat",        icon: "emoji",     text: "Диалоги",     href: "/chat" },
    ],
  },
  {
    label: "Автоматизация",
    items: [
      { id: "bot",        icon: "funnel",    text: "Воронка",     href: "/bot" },
      { id: "broadcasts", icon: "broadcast", text: "Рассылки",    href: "/broadcasts" },
      { id: "abtest",     icon: "abtest",    text: "A/B тесты",   href: "/abtests", chip: "скоро" },
    ],
  },
  {
    label: "Контент",
    items: [
      { id: "posts",    icon: "post",   text: "Посты",     href: "/posts" },
      { id: "landings", icon: "yandex", text: "Лендинги",  href: "/landings" },
      { id: "mini-app", icon: "grid",   text: "Mini App",  href: "/mini-app" },
    ],
  },
  {
    label: "Аналитика",
    items: [
      { id: "traffic",  icon: "analytics", text: "Трафик и кампании", href: "/traffic" },
      { id: "segments", icon: "segment",   text: "Сегменты и теги",   href: "/segments" },
    ],
  },
];

const NAV_BOTTOM: NavItemDef[] = [
  { id: "integrations", icon: "yandex",   text: "Интеграции", href: "/integrations" },
  { id: "help",         icon: "sparkles", text: "Обучение",   href: "/help" },
  { id: "billing",      icon: "billing",  text: "Тариф",      href: "/billing" },
  { id: "settings",     icon: "settings", text: "Настройки",  href: "/settings" },
];

export function BrandMark({ size = 32 }: { size?: number }) {
  // Логотип бренда — цвета не переопределяются в dark mode: это же лого.
  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center" }}>
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <defs>
          <linearGradient id="kk-brand-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5B47FB" />
            <stop offset="100%" stopColor="#7C5CFF" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#kk-brand-grad)" />
        <path d="M8 11 L14 7 L24 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M8 17 L16 12 L24 12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M8 24 L18 17 L24 17" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

function NavItem({ item, active, onNavigate, compact = false }: {
  item: NavItemDef; active: boolean; onNavigate?: () => void; compact?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`kk-nav-item${active ? " is-active" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        height: compact ? 36 : 40,
        padding: "0 14px",
        borderRadius: "var(--r-md)",
        fontSize: compact ? 13.5 : 14,
        fontWeight: active ? 600 : 500,
        textDecoration: "none",
        background: active ? "var(--brand-violet-12)" : "transparent",
        color: active ? "var(--brand-violet-pressed)" : "var(--n-700)",
      }}
    >
      <Icon name={item.icon} size={18} strokeWidth={1.75} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.text}
      </span>
      {item.chip && (
        <span
          className="kk-chip kk-chip-amber"
          style={{ height: 20, fontSize: 11, padding: "0 8px" }}
        >
          {item.chip}
        </span>
      )}
      {item.count && (
        <span className="kk-num" style={{ fontSize: 12, color: "var(--n-400)" }}>
          {item.count}
        </span>
      )}
    </Link>
  );
}

function Sidebar({ active, open, onNavigate }: {
  active?: string; open: boolean; onNavigate: () => void;
}) {
  return (
    <aside
      className={`kk-sidebar${open ? " kk-sidebar--open" : ""}`}
      style={{
        width: 240,
        background: "var(--n-25)",
        borderRight: "1px solid var(--n-100)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Brand row */}
      <div style={{ padding: "18px 16px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <BrandMark size={30} />
        <div
          className="type-h3"
          style={{ flex: 1, fontWeight: 700, lineHeight: 1 }}
        >
          Maxiflow
        </div>
        <button
          className="kk-burger-close kk-btn kk-btn-ghost kk-btn-sm kk-btn-icon"
          aria-label="Закрыть меню"
          onClick={onNavigate}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Main groups */}
      <nav className="kk-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 10px 10px" }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 10 }}>
            {group.label && (
              <div
                style={{
                  padding: "12px 14px 6px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--n-700)",
                  opacity: 0.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.items.map((it) => (
                <NavItem key={it.id} item={it} active={active === it.id} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom nav — integrations / help / billing / settings */}
      <div style={{ borderTop: "1px solid var(--n-100)", padding: "10px 10px 14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {NAV_BOTTOM.map((it) => (
            <NavItem
              key={it.id}
              item={it}
              active={active === it.id}
              onNavigate={onNavigate}
              compact
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title, breadcrumbs, rightSlot, onBurger }: {
  title: string; breadcrumbs?: string[]; rightSlot?: ReactNode; onBurger: () => void;
}) {
  return (
    <header
      className="kk-topbar"
      style={{
        height: 56,
        flexShrink: 0,
        padding: "0 24px",
        // Sticky/blur убраны — топбар живёт вне scroll-контейнера (flex-shrink: 0),
        // так что sticky не работал, а backdrop-filter даром жёг GPU.
        background: "var(--n-0)",
        borderBottom: "1px solid var(--n-100)",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <button
        className="kk-burger kk-btn kk-btn-ghost kk-btn-icon"
        aria-label="Меню"
        onClick={onBurger}
      >
        <Icon name="menu" size={18} />
      </button>

      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div
            className="kk-breadcrumbs type-caption"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--n-500)",
              lineHeight: 1,
              marginBottom: 4,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span aria-hidden style={{ opacity: 0.6, fontSize: 10, lineHeight: 1, flexShrink: 0 }}>
                    •
                  </span>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div
          className="kk-topbar-title type-h2"
          style={{
            fontWeight: 700,
            lineHeight: 1.15,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </div>

      {/* Search — заглушка. Командную палитру подключим позже. */}
      <label
        className="kk-topbar-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 12px",
          width: 280,
          borderRadius: "var(--r-md)",
          background: "var(--n-50)",
          border: "1px solid transparent",
          color: "var(--n-500)",
          cursor: "text",
        }}
      >
        <Icon name="search" size={16} strokeWidth={1.75} />
        <input
          type="text"
          placeholder="Поиск (скоро)"
          className="kk-topbar-search-input"
          readOnly
          aria-label="Поиск (скоро)"
          title="Функция поиска скоро появится"
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: 0,
            background: "transparent",
            outline: "none",
            fontSize: 13.5,
            color: "var(--brand-ink)",
            cursor: "not-allowed",
          }}
        />
        <kbd
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--n-0)",
            boxShadow: "var(--shadow-sm)",
            color: "var(--n-500)",
          }}
        >
          ⌘K
        </kbd>
      </label>

      {rightSlot}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Bell + dot (пока статически как визуальный маркер уведомлений) */}
        <button
          className="kk-btn kk-btn-ghost kk-btn-icon"
          aria-label="Уведомления"
          style={{ position: "relative" }}
        >
          <Icon name="bell" size={18} strokeWidth={1.75} />
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 9,
              right: 10,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--danger)",
              boxShadow: "0 0 0 2px var(--n-0)",
            }}
          />
        </button>

        {/* Avatar-триггер дропдауна (сам dropdown подключим позже). */}
        <Link
          href="/settings"
          aria-label="Профиль"
          className="kk-avatar-trigger"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 40,
            padding: "0 6px 0 4px",
            borderRadius: "var(--r-full)",
            textDecoration: "none",
            color: "var(--n-600)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand-amber), var(--brand-coral))",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            КГ
          </div>
          <Icon name="chevron_d" size={14} strokeWidth={2} />
        </Link>
      </div>
    </header>
  );
}

// Локальные стили для hover/focus состояний (Shell.tsx использует inline-style
// для большинства свойств; hover/focus нельзя выразить inline, поэтому один
// небольшой <style>-блок инжектится один раз внутри .kk).
function ShellStyles() {
  return (
    <style>{`
      .kk-nav-item:hover:not(.is-active) {
        background: var(--n-100);
        color: var(--n-800);
      }
      .kk-topbar-search:hover {
        background: var(--n-100);
      }
      .kk-topbar-search:focus-within {
        background: var(--n-0);
        border-color: var(--brand-violet);
        box-shadow: var(--shadow-focus);
        color: var(--brand-ink);
      }
      .kk-topbar-search-input::placeholder {
        color: var(--n-400);
      }
      .kk-avatar-trigger:hover {
        background: var(--n-100);
        color: var(--n-800);
      }
    `}</style>
  );
}

export function Shell({
  active, title, breadcrumbs, rightSlot, children, bgColor = "var(--brand-paper)",
}: {
  active?: string; title: string; breadcrumbs?: string[]; rightSlot?: ReactNode;
  children: ReactNode; bgColor?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  return (
    <div
      className="kk"
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        background: "var(--n-0)",
        overflow: "hidden",
      }}
    >
      <ShellStyles />
      {menuOpen && <div className="kk-backdrop" onClick={close} />}
      <Sidebar active={active} open={menuOpen} onNavigate={close} />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: bgColor,
        }}
      >
        <TopBar
          title={title}
          breadcrumbs={breadcrumbs}
          rightSlot={rightSlot}
          onBurger={() => setMenuOpen(true)}
        />
        <div className="kk-scroll" style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
