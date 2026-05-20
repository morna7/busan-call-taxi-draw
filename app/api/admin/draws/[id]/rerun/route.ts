import { NextRequest, NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/draw-service";
import { HttpError, jsonError } from "@/lib/http";
import { createPublicCode } from "@/lib/public-code";
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

    const source = rawDraw as DrawRow;
    if (source.status !== "completed") {
      throw new HttpError(409, "rerun_not_allowed", "완료된 의뢰만 재투표할 수 있습니다.");
    }

    if (source.winner_participant_id) {
      throw new HttpError(409, "rerun_not_allowed", "당첨자가 있는 의뢰는 재투표할 수 없습니다.");
    }

    const { count, error: countError } = await client
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("draw_id", source.id);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) > 0) {
      throw new HttpError(409, "rerun_not_allowed", "참여자가 있는 의뢰는 재투표할 수 없습니다.");
    }

    const now = new Date();
    const endAt = new Date(now.getTime() + source.duration_seconds * 1000);
    let inserted: DrawRow | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      const { data, error } = await client
        .from("draws")
        .insert({
          public_code: createPublicCode(),
          title: source.title,
          origin: source.origin,
          destination: source.destination,
          departure_time: source.departure_time,
          estimated_fare: source.estimated_fare,
          customer_request: source.customer_request,
          admin_memo: source.admin_memo,
          status: "open",
          start_at: now.toISOString(),
          end_at: endAt.toISOString(),
          duration_seconds: source.duration_seconds,
          created_by: user.id
        })
        .select("*")
        .single();

      if (error) {
        lastError = error;
        if (error.code !== "23505") {
          throw error;
        }
      } else {
        inserted = data as DrawRow;
      }
    }

    if (!inserted) {
      throw lastError ?? new Error("재투표 의뢰를 만들지 못했습니다.");
    }

    await Promise.all([
      insertAuditLog(client, source.id, "draw_rerun_created", {
        createdBy: user.id,
        newDrawId: inserted.id
      }),
      insertAuditLog(client, inserted.id, "draw_created_from_rerun", {
        createdBy: user.id,
        sourceDrawId: source.id
      })
    ]);

    return NextResponse.json({ ok: true, data: inserted }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
