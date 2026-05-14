import { NextRequest, NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/draw-service";
import { HttpError, jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";
import type { DrawRow } from "@/lib/types";

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
    const { data: rawDraw, error: drawError } = await client
      .from("draws")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (drawError) {
      throw drawError;
    }

    if (!rawDraw) {
      throw new HttpError(404, "draw_not_found", "존재하지 않는 의뢰입니다.");
    }

    const draw = rawDraw as DrawRow;
    if (draw.status === "completed") {
      throw new HttpError(409, "cancel_not_allowed", "완료된 추첨은 취소할 수 없습니다.");
    }

    if (draw.status === "cancelled") {
      return NextResponse.json({ ok: true, data: draw });
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from("draws")
      .update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now
      })
      .eq("id", id)
      .in("status", ["scheduled", "open", "drawing"])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await insertAuditLog(client, id, "draw_cancelled", { cancelledBy: user.id });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return jsonError(error);
  }
}
