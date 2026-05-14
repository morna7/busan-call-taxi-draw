import { NextRequest, NextResponse } from "next/server";
import { finalizeDraw } from "@/lib/draw-finalizer";
import { getParticipantCount, toPublicDrawState } from "@/lib/draw-service";
import { HttpError, jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseDrawRepository } from "@/lib/supabase/draw-repository";
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
    const participantId = typeof body.participantId === "string" ? body.participantId : null;
    const client = createSupabaseAdminClient();
    const { data: draw, error } = await client
      .from("draws")
      .select("*")
      .eq("public_code", publicCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!draw) {
      throw new HttpError(404, "draw_not_found", "존재하지 않는 참여 링크입니다.");
    }

    const repository = createSupabaseDrawRepository(client);
    const result = await finalizeDraw(repository, (draw as DrawRow).id, { trigger: "public" });
    const latestDraw = result.draw ?? (draw as DrawRow);
    const [participantCount, viewerResult] = await Promise.all([
      getParticipantCount(client, latestDraw.id),
      participantId
        ? client
            .from("participants")
            .select("*")
            .eq("id", participantId)
            .eq("draw_id", latestDraw.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    if (viewerResult.error) {
      throw viewerResult.error;
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      outcome: result.outcome,
      data: toPublicDrawState({
        draw: latestDraw,
        participantCount,
        winner: result.winner,
        viewerParticipant: (viewerResult.data as ParticipantRow | null) ?? null,
        serverNow: new Date()
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}
