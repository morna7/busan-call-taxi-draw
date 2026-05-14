import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authCookieNames = cookieStore
      .getAll()
      .map((cookie) => cookie.name)
      .filter((name) => name.startsWith("sb-"));
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    return NextResponse.json({
      ok: true,
      data: {
        serverSeesUser: Boolean(user),
        userEmail: user?.email ?? null,
        userId: user?.id ?? null,
        authCookieCount: authCookieNames.length,
        authCookieNames,
        errorMessage: error?.message ?? null
      }
    });
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        message: caught instanceof Error ? caught.message : "인증 진단 중 오류가 발생했습니다."
      },
      { status: 500 }
    );
  }
}
