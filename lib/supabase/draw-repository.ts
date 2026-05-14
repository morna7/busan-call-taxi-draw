import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrawFinalizerRepository, FinalizeResult } from "@/lib/draw-finalizer";
import type { DrawRow, ParticipantRow } from "@/lib/types";

export function createSupabaseDrawRepository(client: SupabaseClient): DrawFinalizerRepository {
  async function getDraw(drawId: string) {
    const { data, error } = await client
      .from("draws")
      .select("*")
      .eq("id", drawId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as DrawRow | null) ?? null;
  }

  return {
    getDraw,

    async claimDrawForFinalizing(drawId, nowIso) {
      const { data, error } = await client
        .from("draws")
        .update({ status: "drawing", updated_at: nowIso })
        .eq("id", drawId)
        .in("status", ["scheduled", "open"])
        .lte("end_at", nowIso)
        .is("winner_participant_id", null)
        .select("*")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as DrawRow | null) ?? null;
    },

    async listParticipants(drawId) {
      const { data, error } = await client
        .from("participants")
        .select("*")
        .eq("draw_id", drawId)
        .order("joined_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data as ParticipantRow[]) ?? [];
    },

    async completeWithWinner(drawId, winnerParticipantId, details) {
      const { error } = await client.rpc("complete_draw_with_winner", {
        p_draw_id: drawId,
        p_winner_participant_id: winnerParticipantId,
        p_details: details
      });

      if (error) {
        throw error;
      }
    },

    async completeWithoutWinner(drawId, details) {
      const { error } = await client.rpc("complete_draw_without_winner", {
        p_draw_id: drawId,
        p_details: details
      });

      if (error) {
        throw error;
      }
    },

    async getFinalizeResult(drawId) {
      const draw = await getDraw(drawId);
      if (!draw) {
        return null;
      }

      const [{ count, error: countError }, winnerResult] = await Promise.all([
        client
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("draw_id", drawId),
        draw.winner_participant_id
          ? client
              .from("participants")
              .select("*")
              .eq("id", draw.winner_participant_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })
      ]);

      if (countError) {
        throw countError;
      }

      if (winnerResult.error) {
        throw winnerResult.error;
      }

      const outcome: FinalizeResult["outcome"] =
        draw.status === "completed"
          ? "already_completed"
          : draw.status === "cancelled"
            ? "cancelled"
            : draw.status === "drawing"
              ? "in_progress"
              : "not_ready";
      return {
        outcome,
        draw,
        participantCount: count ?? 0,
        winner: (winnerResult.data as ParticipantRow | null) ?? null,
        message: draw.status === "completed" ? "이미 완료된 추첨입니다." : "현재 상태를 확인했습니다."
      } satisfies FinalizeResult;
    }
  };
}
