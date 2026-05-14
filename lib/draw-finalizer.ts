import { randomInt as cryptoRandomInt } from "node:crypto";
import type { DrawRow, ParticipantRow } from "@/lib/types";
import { pickWinner } from "@/lib/draw-rules";

export type FinalizeOutcome =
  | "completed"
  | "already_completed"
  | "not_ready"
  | "cancelled"
  | "in_progress"
  | "not_found";

export type FinalizeResult = {
  outcome: FinalizeOutcome;
  draw: DrawRow | null;
  participantCount: number;
  winner: ParticipantRow | null;
  message: string;
};

export type DrawFinalizerRepository = {
  getDraw(drawId: string): Promise<DrawRow | null>;
  claimDrawForFinalizing(drawId: string, nowIso: string): Promise<DrawRow | null>;
  listParticipants(drawId: string): Promise<ParticipantRow[]>;
  completeWithWinner(
    drawId: string,
    winnerParticipantId: string,
    details: Record<string, unknown>
  ): Promise<void>;
  completeWithoutWinner(drawId: string, details: Record<string, unknown>): Promise<void>;
  getFinalizeResult(drawId: string): Promise<FinalizeResult | null>;
};

export type FinalizeDrawOptions = {
  now?: Date;
  trigger?: "public" | "admin" | "system" | "test";
  requestedBy?: string | null;
  randomInt?: (min: number, max: number) => number;
  pollAttempts?: number;
  pollMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resultFromDraw(draw: DrawRow, outcome: FinalizeOutcome, message: string): FinalizeResult {
  return {
    outcome,
    draw,
    participantCount: 0,
    winner: null,
    message
  };
}

export async function finalizeDraw(
  repository: DrawFinalizerRepository,
  drawId: string,
  options: FinalizeDrawOptions = {}
): Promise<FinalizeResult> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const existingDraw = await repository.getDraw(drawId);

  if (!existingDraw) {
    return {
      outcome: "not_found",
      draw: null,
      participantCount: 0,
      winner: null,
      message: "존재하지 않는 추첨입니다."
    };
  }

  if (existingDraw.status === "cancelled") {
    return resultFromDraw(existingDraw, "cancelled", "취소된 추첨입니다.");
  }

  if (existingDraw.status === "completed") {
    const result = await repository.getFinalizeResult(drawId);
    return result ?? resultFromDraw(existingDraw, "already_completed", "이미 완료된 추첨입니다.");
  }

  if (now.getTime() < new Date(existingDraw.end_at).getTime()) {
    return resultFromDraw(existingDraw, "not_ready", "아직 참여 시간이 남아 있습니다.");
  }

  const claimedDraw = await repository.claimDrawForFinalizing(drawId, nowIso);

  if (!claimedDraw) {
    const attempts = options.pollAttempts ?? 8;
    const pollMs = options.pollMs ?? 150;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const result = await repository.getFinalizeResult(drawId);
      if (result && (result.draw?.status === "completed" || result.draw?.status === "cancelled")) {
        return {
          ...result,
          outcome: result.draw.status === "completed" ? "already_completed" : "cancelled"
        };
      }
      await sleep(pollMs);
    }

    return resultFromDraw(existingDraw, "in_progress", "다른 요청에서 추첨을 처리 중입니다.");
  }

  const participants = await repository.listParticipants(drawId);
  const randomInt = options.randomInt ?? cryptoRandomInt;
  const winner = pickWinner(participants, randomInt);
  const details = {
    trigger: options.trigger ?? "system",
    requestedBy: options.requestedBy ?? null,
    participantCount: participants.length,
    randomSource: "node:crypto.randomInt",
    winnerParticipantId: winner?.id ?? null,
    winnerName: winner?.name ?? null
  };

  if (winner) {
    await repository.completeWithWinner(drawId, winner.id, details);
  } else {
    await repository.completeWithoutWinner(drawId, details);
  }

  const completedResult = await repository.getFinalizeResult(drawId);
  if (completedResult) {
    return {
      ...completedResult,
      outcome: "completed",
      message: winner ? "당첨자가 선정되었습니다." : "참여자 없이 완료되었습니다."
    };
  }

  return {
    outcome: "completed",
    draw: claimedDraw,
    participantCount: participants.length,
    winner,
    message: winner ? "당첨자가 선정되었습니다." : "참여자 없이 완료되었습니다."
  };
}
