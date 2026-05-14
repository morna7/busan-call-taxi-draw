import { NextResponse } from "next/server";
import { getServerEnvDiagnostics } from "@/lib/env-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: getServerEnvDiagnostics()
  });
}
