// AES-256-GCM шифрование чувствительных строк (bot_token, oauth_token).
// Формат: "enc.v1.<base64(iv || ciphertext || tag)>" — версия в префиксе,
// чтобы рулить ротацией ключей и сосуществовать со старыми plain-значениями.
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const PREFIX = "enc.v1.";

function getKey(): Buffer {
  const hex = process.env.MAXIFLOW_ENC_KEY;
  if (!hex) throw new Error("MAXIFLOW_ENC_KEY env not set");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("MAXIFLOW_ENC_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, ct, tag]).toString("base64");
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const buf = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Безопасный decrypt: если значение не зашифровано или ключ отсутствует — отдаёт как есть. */
export function maybeDecrypt(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!isEncrypted(value)) return value;
  try { return decrypt(value); } catch { return null; }
}
