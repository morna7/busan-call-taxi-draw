import { randomInt as cryptoRandomInt } from "node:crypto";
import type { DrawStatus } from "@/lib/types";
import { normalizeName, normalizePhoneLast4 } from "@/lib/validation";

export type JoinEligibilityDraw = {
  status: DrawStatus;
  start_at: string;
  end_at: string;
};

export type ParticipantLike = {
  id: string;
  name: string;
  phone_last4: string | null;
};

export function getJoinEligibility(draw: JoinEligibilityDraw, now = new Date()): {
  ok: boolean;
  code?: string;
  message?: string;
} {
  if (draw.status === "cancelled") {
    return { ok: false, code: "draw_cancelled", message: "취소된 추첨입니다." };
  }

  if (draw.status === "completed") {
    return { ok: false, code: "draw_completed", message: "이미 완료된 추첨입니다." };
  }

  if (draw.status === "drawing") {
    return { ok: false, code: "draw_drawing", message: "추첨 처리 중입니다." };
  }

  if (now.getTime() < new Date(draw.start_at).getTime()) {
    return { ok: false, code: "draw_not_started", message: "아직 참여 시간이 시작되지 않았습니다." };
  }

  if (now.getTime() >= new Date(draw.end_at).getTime()) {
    return { ok: false, code: "draw_closed", message: "참여 시간이 마감되었습니다." };
  }

  return { ok: true };
}

export function participantDuplicateKey(name: string, phoneLast4: string | null | undefined): string {
  return `${normalizeName(name).toLocaleLowerCase("ko-KR")}::${normalizePhoneLast4(phoneLast4) ?? ""}`;
}

export function hasDuplicateParticipant(
  participants: ParticipantLike[],
  name: string,
  phoneLast4: string | null | undefined
): boolean {
  const target = participantDuplicateKey(name, phoneLast4);
  return participants.some((participant) => {
    return participantDuplicateKey(participant.name, participant.phone_last4) === target;
  });
}

export function pickWinner<T extends ParticipantLike>(
  participants: T[],
  randomInt: (min: number, max: number) => number = cryptoRandomInt
): T | null {
  if (participants.length === 0) {
    return null;
  }

  return participants[randomInt(0, participants.length)];
}
