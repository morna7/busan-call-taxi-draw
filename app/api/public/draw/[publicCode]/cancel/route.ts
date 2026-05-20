import { NextRequest, NextResponse } from "next/server";
import { getJoinEligibility } from "@/lib/draw-rules";
import {
  getParticipantCount,
  getPublicParticipants,
  insertAuditLog,
  openDrawIfNeeded,
  toPublicDrawState
} from "@/lib/draw-service";
import { HttpError, jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DrawRow, ParticipantRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicCode: string }> }
) {
  try {
    const { publicCode } = await context.params;
    const body = await request.json().catch(() => ({}));
    const participantId = typeof body.participantId === "string" ? body.participantId : "";

    if (!participantId) {
      throw new HttpError(400, "participant_required", "취소할 참여 내역을 찾지 못했습니다.");
    }

    const client = createSupabaseAdminClient();
    const now = new Date();
    const { data: rawDraw, error: drawError } = await client
      .from("draws")
      .select("*")
      .eq("public_code", publicCode)
      .maybeSingle();

    if (drawError) {
      throw drawError;
    }

    if (!rawDraw) {
      throw new HttpError(404, "draw_not_found", "존재하지 않는 참여 링크입니다.");
    }

    const draw = await openDrawIfNeeded(client, rawDraw as DrawRow, now);
    const eligibility = getJoinEligibility(draw, now);
    if (!eligibility.ok) {
      throw new HttpError(
        409,
        eligibility.code ?? "cancel_not_allowed",
        "참여 시간이 끝난 의뢰는 취소할 수 없습니다."
      );
    }

    const { data: participant, error: participantError } = await client
      .from("participants")
      .select("*")
      .eq("id", participantId)
      .eq("draw_id", draw.id)
      .maybeSingle();

    if (participantError) {
      throw participantError;
    }

    if (!participant) {
      throw new HttpError(404, "participant_not_found", "취소할 참여 내역을 찾지 못했습니다.");
    }

    const { error: deleteError } = await client
      .from("participants")
      .delete()
      .eq("id", participantId)
      .eq("draw_id", draw.id);

    if (deleteError) {
      throw deleteError;
    }

    const cancelledParticipant = participant as ParticipantRow;
    await insertAuditLog(client, draw.id, "participant_cancelled", {
      participantId,
      name: cancelledParticipant.name,
      hasVehicleLast4: Boolean(cancelledParticipant.phone_last4)
    });

    const [participantCount, publicParticipants] = await Promise.all([
      getParticipantCount(client, draw.id),
      getPublicParticipants(client, draw.id)
    ]);

    return NextResponse.json({
      ok: true,
      message: "참여가 취소되었습니다.",
      data: toPublicDrawState({
        draw,
        participantCount,
        winner: null,
        viewerParticipant: null,
        publicParticipants,
        serverNow: now
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}
