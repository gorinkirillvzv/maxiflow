export const metadata = { title: "Удаление данных — Maxiflow" };

export default function PolicyFbPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", lineHeight: 1.6, color: "#222" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Удаление пользовательских данных</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Инструкция для пользователей, взаимодействовавших с Instagram-аккаунтом, подключённым к Maxiflow.</p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Как запросить удаление</h2>
      <p>
        Напишите на <a href="mailto:support@maxiflow.ru">support@maxiflow.ru</a> с темой «Удаление данных
        Instagram» и укажите ваш Instagram username (или IGSID, если известен) — тот аккаунт, комментарии
        или сообщения которого нужно удалить.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Что будет удалено</h2>
      <p>
        Сохранённые в Maxiflow текст комментариев и сообщений, привязанных к указанному Instagram-аккаунту,
        а также связанные с ним служебные записи (история обращений в кабинете владельца).
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Сроки</h2>
      <p>Запрос обрабатывается в течение 30 дней с момента получения.</p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Политика конфиденциальности</h2>
      <p>
        Подробнее о том, какие данные собираются и зачем — на странице{" "}
        <a href="/privacy-fb">maxiflow.ru/privacy-fb</a>.
      </p>
      </div>
    </div>
  );
}
