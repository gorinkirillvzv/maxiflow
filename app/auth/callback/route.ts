// Callback подтверждения email: Supabase редиректит сюда с ?code=...
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://maxiflow.ru";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${APP_URL}/dashboard`);
    }
  }

  return NextResponse.redirect(`${APP_URL}/login?error=confirm`);
}
