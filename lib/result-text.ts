import { formatResultDateTime } from "@/lib/time";
import type { AdminDrawDetail } from "@/lib/types";

export function buildResultText(draw: AdminDrawDetail): string {
  const winner = draw.participants.find((participant) => participant.id === draw.winnerParticipantId);

  return [
    "[장거리전문부산콜택시 배차 추첨 결과]",
    `의뢰: ${draw.title}`,
    `출발지: ${draw.origin}`,
    `도착지: ${draw.destination}`,
    `참여자 수: ${draw.participantCount}명`,
    `당첨자: ${winner?.name ?? "참여자 없음"}`,
    `추첨 완료 시간: ${formatResultDateTime(draw.drawnAt)}`
  ].join("\n");
}
