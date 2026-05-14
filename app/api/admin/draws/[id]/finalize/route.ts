import { NextRequest, NextResponse } from "next/server";
import { finalizeDraw } from "@/lib/draw-finalizer";
import { jsonError } from "@/lib/http";
import { loadAdminDrawDetail } from "@/lib/admin-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseDrawRepository } from "@/lib/supabase/draw-repository";
import { requireAdminUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    const { id } = await context.params;
    const client = createSupabaseAdminClient();
    const repository = createSupabaseDrawRepository(client);
    const result = await finalizeDraw(repository, id, {
      trigger: "admin",
      requestedBy: user.id
    });
    const detail = await loadAdminDrawDetail(client, id);

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      message: result.message,
      data: detail
    });
  } catch (error) {
    return jsonError(error);
  }
}
