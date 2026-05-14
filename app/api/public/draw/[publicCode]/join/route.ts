import { NextRequest, NextResponse } from "next/server";
import { getJoinEligibility, participantDuplicateKey } from "@/lib/draw-rules";
import {
  getParticipantCount,
  getPublicParticipants,
  insertAuditLog,
  openDrawIfNeeded,
  toPublicDrawState
} from "@/lib/draw-service";
import { hashUserAgent } from "@/lib/hash";
import { HttpError, jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DrawRow, ParticipantRow } from "@/lib/types";
import { validateParticipantInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicCode: string }> }
) {
  try {
    const { publicCode } = await context.params;
    const body = await request.json().catch(() => ({}));
    const validation = validateParticipantInput({
      name: body.nickname ?? body.name,
      phoneLast4: body.vehicleLast4 ?? body.phoneLast4
    });

    if (!validation.ok) {
      throw new HttpError(400, validation.code, validation.message);
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
      throw new HttpError(409, eligibility.code ?? "join_not_allowed", eligibility.message ?? "참여할 수 없습니다.");
    }

    const { data: existingParticipants, error: participantsError } = await client
      .from("participants")
      .select("*")
      .eq("draw_id", draw.id);

    if (participantsError) {
      throw participantsError;
    }

    const normalizedKey = participantDuplicateKey(
      validation.value.name,
      validation.value.phoneLast4
    );
    const duplicate = ((existingParticipants as ParticipantRow[]) ?? []).find((participant) => {
      return participantDuplicateKey(participant.name, participant.phone_last4) === normalizedKey;
    });

    if (duplicate) {
      const [participantCount, publicParticipants] = await Promise.all([
        getParticipantCount(client, draw.id),
        getPublicParticipants(client, draw.id)
      ]);
      return NextResponse.json({
        ok: true,
        alreadyJoined: true,
        message: "이미 참여한 의뢰입니다.",
        data: toPublicDrawState({
          draw,
          participantCount,
          winner: null,
          viewerParticipant: duplicate,
          publicParticipants,
          serverNow: now
        })
      });
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
    const { data: inserted, error: insertError } = await client
      .from("participants")
      .insert({
        draw_id: draw.id,
        name: validation.value.name,
        phone_last4: validation.value.phoneLast4,
        user_agent_hash: hashUserAgent(`${userAgent}|${forwardedFor}`)
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        throw new HttpError(409, "already_joined", "이미 참여한 의뢰입니다.");
      }
      throw insertError;
    }

    await insertAuditLog(client, draw.id, "participant_joined", {
      participantId: inserted.id,
      name: validation.value.name,
      hasVehicleLast4: Boolean(validation.value.phoneLast4)
    });

    const [participantCount, publicParticipants] = await Promise.all([
      getParticipantCount(client, draw.id),
      getPublicParticipants(client, draw.id)
    ]);

    return NextResponse.json({
      ok: true,
      alreadyJoined: false,
      message: "참여가 완료되었습니다.",
      data: toPublicDrawState({
        draw,
        participantCount,
        winner: null,
        viewerParticipant: inserted as ParticipantRow,
        publicParticipants,
        serverNow: now
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}
