// Серверная сторона workspace-switcher'а: читаем платформу из cookie запроса.
// Используется в API-роутах и server components для фильтрации ботов.
import { cookies } from "next/headers";
import { PLATFORM_COOKIE, isPlatform, type Platform } from "./platform";

export async function getActivePlatform(): Promise<Platform> {
  try {
    const store = await cookies();
    const v = store.get(PLATFORM_COOKIE)?.value;
    if (isPlatform(v)) return v;
  } catch { /* вне request-контекста */ }
  return "max";
}
