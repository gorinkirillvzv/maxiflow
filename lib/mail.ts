// Отправка transactional email через Yandex 360 SMTP.
// SMTP-настройки в env (SMTP_HOST / PORT / USER / PASS / FROM).
import nodemailer from "nodemailer";

let cachedTransport: nodemailer.Transporter | null = null;

function transporter(): nodemailer.Transporter {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP env not set (SMTP_HOST/USER/PASS)");
  cachedTransport = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransport;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  await transporter().sendMail({
    from: `Maxiflow <${from}>`,
    to,
    subject,
    html,
  });
}
