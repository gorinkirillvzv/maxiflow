// Maxiflow — интеграции: MAX-бот, Яндекс.Метрика, Директ и VK Реклама
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { MetrikaConnectForm } from "@/components/MetrikaConnectForm";
import { MetrikaDomainHint } from "@/components/MetrikaDomainHint";
import { MetrikaGoalsEditor } from "@/components/MetrikaGoalsEditor";
import { VkPixelsManager } from "@/components/VkPixelsManager";

const ERRORS: Record<string, string> = {
  counter: "Не указан ID счётчика",
  tenant: "Арендатор не найден",
  state: "Не удалось начать авторизацию",
  denied: "Доступ в Яндексе не выдан",
  params: "Некорректный ответ Яндекса",
  used: "Ссылка авторизации уже использована — начните заново",
  token: "Не удалось получить токен от Яндекса",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: configs } = await supabase
    .from("metrika_configs")
    .select("id, counter_id, goal_name, subscribed_goal_name, is_active")
    .eq("is_active", true);
  const metrika = configs?.[0] ?? null;
  const { data: directAcc } = await supabase
    .from("direct_accounts")
    .select("account_login")
    .eq("is_active", true)
    .maybeSingle();
  const { data: vkList } = await supabase
    .from("vk_pixel_configs")
    .select("id")
    .eq("is_active", true);
  const vkCount = vkList?.length ?? 0;

  const { data: maxBots } = await supabase
    .from("bots")
    .select("id, max_bot_username, channel_title")
    .eq("platform", "max")
    .eq("is_active", true);
  const maxBotsCount = maxBots?.length ?? 0;

  return (
    <Shell active="integrations" title="Интеграции" breadcrumbs={["Настройки", "Интеграции"]}>
      <div style={{ padding: "24px 32px 40px", maxWidth: 720 }}>

        {sp.metrika === "ok" && (
          <div className="kk-row kk-gap-2 kk-sm" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "var(--success-12)", color: "#0A7A3C" }}>
            <Icon name="check" size={15} strokeWidth={2.4} /> Метрика подключена
          </div>
        )}
        {sp.error && (
          <div className="kk-row kk-gap-2 kk-sm" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "var(--brand-coral-12)", color: "#B12E1A" }}>
            <Icon name="close" size={15} /> {ERRORS[sp.error] ?? "Ошибка подключения"}
          </div>
        )}

        {/* MAX-бот и канал */}
        <div className="kk-card kk-pad-6" style={{ marginBottom: 16 }}>
          <div className="kk-row kk-gap-3" style={{ marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#2E7DFF,#1EC8FF)", display: "grid", placeItems: "center" }}>
              <Icon name="max" size={24} stroke="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>MAX-бот и канал</div>
              <div className="kk-sm kk-muted">Подключите бота MAX и привяжите к нему канал — точка входа для всей воронки</div>
            </div>
            {maxBotsCount > 0 && (
              <span className="kk-chip kk-chip-green kk-chip-dot">
                {maxBotsCount === 1 ? "подключён" : `${maxBotsCount} шт.`}
              </span>
            )}
          </div>

          {maxBotsCount > 0 ? (
            <div className="kk-col kk-gap-2" style={{ padding: 14, borderRadius: 10, background: "var(--n-50)", marginBottom: 12 }}>
              {(maxBots ?? []).map((b) => (
                <div key={b.id} className="kk-row kk-gap-2 kk-sm">
                  <Icon name="check" size={16} stroke="var(--success)" strokeWidth={2.4} />
                  <div style={{ flex: 1 }}>
                    <b>{b.channel_title ?? b.max_bot_username}</b>{" "}
                    <span className="kk-muted">· @{b.max_bot_username}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <Link href="/channels" className="kk-btn kk-btn-accent">
            <Icon name="plus" size={14} />
            {maxBotsCount > 0 ? "Управлять ботами" : "Подключить MAX-бот"}
          </Link>
        </div>

        {/* Метрика */}
        <div className="kk-card kk-pad-6" style={{ marginBottom: 16 }}>
          <div className="kk-row kk-gap-3" style={{ marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#FFCC00,#FFB020)", display: "grid", placeItems: "center" }}>
              <Icon name="yandex" size={24} stroke="#15141C" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Яндекс.Метрика</div>
              <div className="kk-sm kk-muted">Офлайн-конверсии по выданным магнитам — Директ учится на реальных подписчиках</div>
            </div>
            {metrika && <span className="kk-chip kk-chip-green kk-chip-dot">подключена</span>}
          </div>

          {metrika ? (
            <div className="kk-col kk-gap-2" style={{ padding: 14, borderRadius: 10, background: "var(--n-50)" }}>
              <div className="kk-row kk-gap-2 kk-sm">
                <Icon name="check" size={16} stroke="var(--success)" strokeWidth={2.4} />
                <div>Счётчик <b>{metrika.counter_id}</b></div>
              </div>
              <MetrikaGoalsEditor
                counterId={metrika.counter_id}
                initialMagnetGoal={metrika.goal_name}
                initialSubscribedGoal={metrika.subscribed_goal_name ?? ""}
              />
            </div>
          ) : (
            <MetrikaConnectForm />
          )}

          <MetrikaDomainHint counterId={metrika?.counter_id} />
        </div>

        {/* VK Реклама */}
        <div className="kk-card kk-pad-6" style={{ marginBottom: 16 }}>
          <div className="kk-row kk-gap-3" style={{ marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#0077FF,#0044BB)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>
              VK
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>VK Реклама</div>
              <div className="kk-sm kk-muted">Офлайн-конверсии в VK Pixel — учат рекламные алгоритмы на реальных подписчиках</div>
            </div>
            {vkCount > 0 && <span className="kk-chip kk-chip-green kk-chip-dot">{vkCount} {vkCount === 1 ? "пиксель" : "пикселей"}</span>}
          </div>

          <VkPixelsManager />

          <div className="kk-xs kk-muted" style={{ marginTop: 12, lineHeight: 1.55 }}>
            <b>Что вписать в URL объявления VK Реклама:</b>{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>?rb_clickid={"{{clickid}}"}</code>{" "}
            (макрос VK сам подставит реальный click id). При выдаче магнита воркер пушит событие во все подключённые пиксели —{" "}
            каждый из них учтёт только свой rb_clickid.
            <br />
            <b>Где взять Pixel ID и название события:</b> в VK Рекламе → Сайты → События → Добавить событие → JS-событие → «Как подключить событие».
          </div>
        </div>

        {/* Директ */}
        <div className="kk-card kk-pad-6">
          <div className="kk-row kk-gap-3" style={{ marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#FFCC00,#FF3B30)", display: "grid", placeItems: "center" }}>
              <Icon name="yandex" size={24} stroke="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Яндекс.Директ</div>
              <div className="kk-sm kk-muted">Синхронизация кампаний и расхода — для расчёта ROI и цены подписчика</div>
            </div>
            {directAcc && <span className="kk-chip kk-chip-green kk-chip-dot">подключён</span>}
          </div>

          {directAcc ? (
            <div className="kk-row kk-gap-3" style={{ padding: 14, borderRadius: 10, background: "var(--n-50)" }}>
              <Icon name="check" size={18} stroke="var(--success)" strokeWidth={2.4} />
              <div className="kk-sm" style={{ flex: 1 }}>
                Аккаунт <b>{directAcc.account_login || "Директ"}</b> подключён
              </div>
              <a href="/campaigns" className="kk-btn kk-btn-outline kk-btn-sm">Открыть кампании</a>
            </div>
          ) : (
            <div>
              <div className="kk-sm kk-muted" style={{ marginBottom: 10 }}>
                Аккаунт Директа подключается в разделе «Кампании Директа».
              </div>
              <a href="/campaigns" className="kk-btn kk-btn-accent">
                <Icon name="link" size={15} /> Перейти к подключению
              </a>
            </div>
          )}
        </div>

      </div>
    </Shell>
  );
}
