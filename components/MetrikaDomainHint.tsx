"use client";
// Памятка для клиента: в настройках счётчика Метрики надо указать наш домен,
// иначе Метрика отбросит визиты со страницы /r/<bot> и оффлайн-конверсии не сматчатся.
import { useState } from "react";
import { Icon } from "./Icon";

export function MetrikaDomainHint({ counterId }: { counterId?: number | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="kk-card kk-pad-4" style={{ marginTop: 14, background: "var(--brand-amber-12)" }}>
      <div className="kk-row kk-gap-2" style={{ marginBottom: 8 }}>
        <Icon name="bell" size={16} stroke="#8A5A00" />
        <div style={{ fontWeight: 600, fontSize: 14, color: "#8A5A00" }}>
          Важно: укажи в Метрике наш домен
        </div>
      </div>
      <div className="kk-sm" style={{ lineHeight: 1.55, marginBottom: 10 }}>
        Maxiflow регистрирует визиты с yclid на странице{" "}
        <code style={{ fontFamily: "var(--font-mono)", background: "var(--n-0)", padding: "1px 5px", borderRadius: 4 }}>maxiflow.ru/r/...</code>.
        Чтобы Метрика принимала эти визиты и матчила офлайн-конверсии:
      </div>
      <ol className="kk-sm" style={{ paddingLeft: 22, lineHeight: 1.7, margin: 0 }}>
        <li>
          Открой{" "}
          <a
            href={counterId ? `https://metrika.yandex.ru/settings?id=${counterId}` : "https://metrika.yandex.ru/list"}
            target="_blank" rel="noreferrer"
            style={{ color: "var(--brand-violet)", fontWeight: 600 }}
          >
            настройки счётчика
          </a>
        </li>
        <li>
          В поле <b>«Адрес сайта»</b> впиши{" "}
          <code style={{ fontFamily: "var(--font-mono)", background: "var(--n-0)", padding: "1px 5px", borderRadius: 4 }}>maxiflow.ru</code>
        </li>
        <li>Поставь галку <b>«Включая поддомены»</b></li>
        <li>Жми <b>«Сохранить»</b></li>
      </ol>
      <button className="kk-btn kk-btn-ghost kk-btn-sm" style={{ marginTop: 10 }}
        onClick={() => {
          navigator.clipboard?.writeText("maxiflow.ru");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>
        <Icon name="copy" size={12} /> {copied ? "Скопировано" : "Скопировать «maxiflow.ru»"}
      </button>
    </div>
  );
}
