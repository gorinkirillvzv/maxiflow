export const metadata = { title: "Политика конфиденциальности — Maxiflow" };

export default function PrivacyFbPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", lineHeight: 1.6, color: "#222" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Политика конфиденциальности</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Действует для интеграции Maxiflow с Instagram/Meta.</p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Какие данные собираются</h2>
      <p>
        При подключении Instagram-аккаунта через Maxiflow и взаимодействии подписчиков с этим аккаунтом
        (комментарии под публикациями, сообщения в Direct) мы получаем и сохраняем:
      </p>
      <ul>
        <li>Instagram-идентификатор пользователя (IGSID) и, если доступен, username;</li>
        <li>текст комментариев и сообщений, отправленных подключённому аккаунту;</li>
        <li>служебные метаданные (время события, идентификатор поста/комментария).</li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Зачем</h2>
      <p>
        Данные используются исключительно для работы автоматических ответов (выдача материалов по
        комментарию, ответы в Direct) и для того, чтобы владелец подключённого аккаунта видел историю
        обращений в своём кабинете Maxiflow.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Хранение и доступ</h2>
      <p>
        Данные хранятся в базе данных Maxiflow (Supabase) и доступны только владельцу подключённого
        Instagram-аккаунта через его личный кабинет. Третьим лицам данные не передаются и не продаются.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Удаление данных</h2>
      <p>
        Инструкция по запросу удаления данных — на странице{" "}
        <a href="/policy-fb">maxiflow.ru/policy-fb</a>.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Контакты</h2>
      <p>
        По вопросам обработки данных: <a href="mailto:support@maxiflow.ru">support@maxiflow.ru</a>
      </p>
      </div>
    </div>
  );
}
