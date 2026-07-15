// Supabase service-role клиент — ТОЛЬКО для серверных роутов (OAuth-флоу).
// Обходит RLS. Никогда не импортировать в клиентские компоненты.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
