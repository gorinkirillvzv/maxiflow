// Maxiflow — wizard первого запуска. Полноэкранный поток для новых клиентов.
// Каждый шаг автодетектируется по состоянию БД. После прохождения всех →
// кнопка ведёт на /traffic.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";

type Step = {
  key: string;
  done: boolean;
  title: string;
  desc: string;
  href: string;
  cta: string;
};

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { count: botCount },
    { count: magnetCount },
    { count: funnelCount },
    { count: metrikaCount },
    { count: directCount },
  ] = await Promise.all([
    supabase.from("bots").select("id", { count: "exact", head: true }),
    supabase.from("magnets").select("id", { count: "exact", head: true }),
    supabase.from("funnels").select("id", { count: "exact", head: true }),
    supabase.from("metrika_configs").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("direct_accounts").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const steps: Step[] = [
    {
      key: "bot",
      done: (botCount ?? 0) > 0,
      title: "Подключи бот и канал MAX",
      desc: "Бот-помощник принимает подписчиков из рекламы и общается с ними от твоего лица.",
      href: "/channels",
      cta: "Открыть «Каналы»",
    },
    {
      key: "magnet",
      done: (magnetCount ?? 0) > 0,
      title: "Создай лид-магнит",
      desc: "Что подписчик получит за подписку: PDF, ссылка на видео, текст с инструкцией.",
      href: "/magnets",
      cta: "Открыть «Магниты»",
    },
    {
      key: "funnel",
      done: (funnelCount ?? 0) > 0,
      title: "Собери воронку",
      desc: "Что бот пишет подписчику: приветствие → проверка подписки → выдача магнита.",
      href: "/bot",
      cta: "Открыть конструктор воронки",
    },
    {
      key: "metrika",
      done: (metrikaCount ?? 0) > 0,
      title: "Подключи Яндекс.Метрику",
      desc: "Maxiflow отправит конверсии: каждый получивший магнит = одна цель. После OAuth не забудь в настройках счётчика прописать «Адрес сайта» = maxiflow.ru — иначе визиты с yclid не сматчатся.",
      href: "/integrations",
      cta: "Подключить Метрику",
    },
    {
      key: "direct",
      done: (directCount ?? 0) > 0,
      title: "Подключи Яндекс.Директ",
      desc: "Чтобы видеть расход и стоимость подписчика по каждой кампании. Опционально, если планируешь рекламу в Директе.",
      href: "/integrations",
      cta: "Подключить Директ",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <Shell active="setup" title="Запуск Maxiflow" breadcrumbs={["Запуск"]}>
      <div style={{ padding: "32px 24px 60px", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div className="kk-row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {allDone ? "🎉 Готово!" : "Подключи Maxiflow за 5 шагов"}
            </div>
            <span className="kk-sm kk-muted">{doneCount} из {steps.length}</span>
          </div>
          <div style={{ height: 8, background: "var(--n-100)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${(doneCount / steps.length) * 100}%`,
              background: "linear-gradient(90deg, var(--brand-violet), #7C5CFF)",
              transition: "width .4s ease",
            }} />
          </div>
          <div className="kk-sm kk-muted" style={{ marginTop: 10, lineHeight: 1.55 }}>
            {allDone
              ? "Вся инфраструктура подключена. Создавай первую рекламную кампанию — Maxiflow начнёт собирать подписки и отправлять конверсии в Метрику."
              : "Каждый шаг — отдельный экран в кабинете. Закончил → вернись сюда, статус обновится автоматически. Можешь не делать всё за раз — сохраняется."}
          </div>
        </div>

        <div className="kk-col kk-gap-2">
          {steps.map((s, i) => {
            // первый незавершённый — «текущий» шаг (выделен)
            const isCurrent = !s.done && steps.slice(0, i).every((p) => p.done);
            return (
              <div key={s.key} className="kk-card kk-pad-5" style={{
                border: isCurrent ? "2px solid var(--brand-violet)" : "1px solid var(--n-100)",
                opacity: s.done ? 0.7 : 1,
                position: "relative",
              }}>
                <div className="kk-row kk-gap-3" style={{ alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700,
                    background: s.done ? "var(--success)" : isCurrent ? "var(--brand-violet)" : "var(--n-100)",
                    color: s.done || isCurrent ? "#fff" : "var(--n-500)",
                  }}>
                    {s.done ? <Icon name="check" size={16} strokeWidth={2.6} /> : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 16,
                      textDecoration: s.done ? "line-through" : "none",
                      color: s.done ? "var(--n-500)" : "var(--brand-ink)",
                    }}>
                      {s.title}
                    </div>
                    <div className="kk-sm kk-muted" style={{ marginTop: 4, lineHeight: 1.55 }}>
                      {s.desc}
                    </div>
                    {!s.done && (
                      <div style={{ marginTop: 14 }}>
                        <Link href={s.href} className={isCurrent ? "kk-btn kk-btn-accent" : "kk-btn kk-btn-outline"}>
                          {s.cta} →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="kk-card kk-pad-5" style={{
          marginTop: 24,
          background: allDone ? "var(--success-12)" : "var(--brand-violet-12)",
        }}>
          {allDone ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#0A7A3C", marginBottom: 8 }}>
                Maxiflow готов запускать рекламу
              </div>
              <div className="kk-sm" style={{ marginBottom: 14, lineHeight: 1.55 }}>
                Следующий шаг — выбрать тип трафика для первой кампании: свой лендинг + JS-сниппет,
                наш мини-лендинг или невидимый редирект. Это решается под каждую кампанию отдельно.
              </div>
              <Link href="/traffic" className="kk-btn kk-btn-accent kk-btn-lg">
                Создать первую кампанию →
              </Link>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--brand-violet-pressed)", marginBottom: 6 }}>
                Подключение настраивается один раз
              </div>
              <div className="kk-sm" style={{ lineHeight: 1.55 }}>
                После этих шагов под каждую новую рекламную кампанию будешь делать ~30 секунд:
                на странице «Трафик» выбираешь способ доставки (свой лендинг / наш / редирект),
                копируешь готовую ссылку и вставляешь в Директ или паблик.
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <Link href="/dashboard?skip_setup=1" className="kk-sm kk-muted" style={{ textDecoration: "underline" }}>
            Пропустить и перейти на дашборд
          </Link>
        </div>
      </div>
    </Shell>
  );
}
