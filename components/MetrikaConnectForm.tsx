"use client";
// Каскад — форма подключения Яндекс.Метрики (запускает OAuth-флоу)
import { useState } from "react";
import { Icon } from "@/components/Icon";

export function MetrikaConnectForm() {
  const [counter, setCounter] = useState("");

  function connect() {
    if (!/^\d+$/.test(counter.trim())) return;
    window.location.href = `/api/oauth/yandex/start?counter_id=${counter.trim()}`;
  }

  return (
    <div>
      <label className="kk-label">ID счётчика Метрики</label>
      <div className="kk-row kk-gap-2" style={{ marginTop: 6 }}>
        <input className="kk-input" style={{ flex: 1 }}
          value={counter} onChange={(e) => setCounter(e.target.value)}
          placeholder="например 109330078" inputMode="numeric" />
        <button className="kk-btn kk-btn-accent" onClick={connect}
          disabled={!/^\d+$/.test(counter.trim())}
          style={{ opacity: /^\d+$/.test(counter.trim()) ? 1 : 0.6 }}>
          <Icon name="yandex" size={15} /> Подключить Метрику
        </button>
      </div>
      <div className="kk-xs kk-muted" style={{ marginTop: 8 }}>
        Откроется Яндекс — разрешите доступ к загрузке данных счётчика. Каскад будет
        отправлять офлайн-конверсии по выданным магнитам.
      </div>
    </div>
  );
}
