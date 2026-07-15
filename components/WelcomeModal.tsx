"use client";
// Maxiflow — приветственное окно онбординга. Показывается, пока у арендатора
// не подключён ни один канал/бот: помогает сделать первый шаг.
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { BrandMark } from "./Shell";

export function WelcomeModal() {
  const [closed, setClosed] = useState(false);
  const [hasChannel, setHasChannel] = useState<boolean | null>(null);
  if (closed) return null;

  return (
    <div onClick={() => setClosed(true)}
      style={{
        position: "fixed", inset: 0, zIndex: 90, padding: 20,
        background: "rgba(21,20,28,0.5)", display: "grid", placeItems: "center",
      }}>
      <div onClick={(e) => e.stopPropagation()} className="kk-card"
        style={{ maxWidth: 440, width: "100%", padding: 28, position: "relative" }}>

        <button onClick={() => setClosed(true)} aria-label="Закрыть"
          style={{
            position: "absolute", top: 14, right: 14, width: 28, height: 28,
            border: 0, background: "var(--n-100)", borderRadius: 8, cursor: "pointer",
            display: "grid", placeItems: "center",
          }}>
          <Icon name="close" size={15} />
        </button>

        <div className="kk-row kk-gap-3" style={{ marginBottom: 14 }}>
          <BrandMark size={34} />
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>
            Добро пожаловать в Maxiflow
          </div>
        </div>

        {hasChannel === null && (
          <>
            <div className="kk-sm" style={{ color: "var(--n-600)", lineHeight: 1.5, marginBottom: 18 }}>
              Maxiflow приводит подписчиков из рекламы в ваш канал MAX и считает их
              стоимость. Для старта нужен канал MAX и бот-помощник в нём.
            </div>
            <div className="kk-sm" style={{ fontWeight: 600, marginBottom: 10 }}>
              У вас уже есть канал в MAX?
            </div>
            <div className="kk-row kk-gap-2">
              <button className="kk-btn kk-btn-accent" style={{ flex: 1 }}
                onClick={() => setHasChannel(true)}>
                Да, есть
              </button>
              <button className="kk-btn kk-btn-outline" style={{ flex: 1 }}
                onClick={() => setHasChannel(false)}>
                Пока нет
              </button>
            </div>
          </>
        )}

        {hasChannel === true && (
          <>
            <div className="kk-sm" style={{ color: "var(--n-600)", lineHeight: 1.5, marginBottom: 18 }}>
              Отлично! Осталось подключить канал к Maxiflow — добавить бота-помощника
              и вставить токен. Займёт пару минут, на странице подключения всё по шагам.
            </div>
            <Link href="/channels" className="kk-btn kk-btn-accent kk-btn-lg" style={{ width: "100%" }}>
              Подключить канал <Icon name="arrow_r" size={16} />
            </Link>
          </>
        )}

        {hasChannel === false && (
          <>
            <div className="kk-sm" style={{ fontWeight: 600, marginBottom: 10 }}>
              Сначала создайте канал в MAX:
            </div>
            <div className="kk-col kk-gap-2" style={{ marginBottom: 18 }}>
              {[
                "Откройте приложение MAX",
                "Создайте новый канал",
                "Вернитесь сюда и подключите его к Maxiflow",
              ].map((step, i) => (
                <div key={i} className="kk-row kk-gap-2 kk-sm">
                  <span style={{
                    width: 20, height: 20, borderRadius: 99, flexShrink: 0,
                    background: "var(--brand-violet-12)", color: "var(--brand-violet-pressed)",
                    display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
                  }}>{i + 1}</span>
                  <span style={{ color: "var(--n-600)" }}>{step}</span>
                </div>
              ))}
            </div>
            <Link href="/channels" className="kk-btn kk-btn-accent kk-btn-lg" style={{ width: "100%" }}>
              Перейти к подключению <Icon name="arrow_r" size={16} />
            </Link>
          </>
        )}

        <button onClick={() => setClosed(true)} className="kk-btn kk-btn-ghost kk-btn-sm"
          style={{ width: "100%", marginTop: 8 }}>
          Позже
        </button>
      </div>
    </div>
  );
}
