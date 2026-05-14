import { NextRequest, NextResponse } from "next/server";
import { jsonError, HttpError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getParticipantCount, openDrawIfNeeded, toPublicDrawState } from "@/lib/draw-service";
import type { DrawRow, ParticipantRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicCode: string }> }
) {
  try {
    const { publicCode } = await context.params;
    const participantId = request.nextUrl.searchParams.get("participantId");
    const client = createSupabaseAdminClient();
    const now = new Date();

    const { data: rawDraw, error } = await client
      .from("draws")
      .select("*")
      .eq("public_code", publicCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!rawDraw) {
      throw new HttpError(404, "draw_not_found", "존재하지 않는 참여 링크입니다.");
    }

    const draw = await openDrawIfNeeded(client, rawDraw as DrawRow, now);
    const [participantCount, winnerResult, viewerResult] = await Promise.all([
      getParticipantCount(client, draw.id),
      draw.winner_participant_id
        ? client
            .from("participants")
            .select("*")
            .eq("id", draw.winner_participant_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      participantId
        ? client
            .from("participants")
            .select("*")
            .eq("id", participantId)
            .eq("draw_id", draw.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    if (winnerResult.error) {
      throw winnerResult.error;
    }

    if (viewerResult.error) {
      throw viewerResult.error;
    }

    return NextResponse.json({
      ok: true,
      data: toPublicDrawState({
        draw,
        participantCount,
        winner: (winnerResult.data as ParticipantRow | null) ?? null,
        viewerParticipant: (viewerResult.data as ParticipantRow | null) ?? null,
        serverNow: now
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}
