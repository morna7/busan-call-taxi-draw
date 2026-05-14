import { describe, expect, it } from "vitest";
import { finalizeDraw, type DrawFinalizerRepository } from "@/lib/draw-finalizer";
import type { DrawRow, ParticipantRow } from "@/lib/types";

function createDraw(overrides: Partial<DrawRow> = {}): DrawRow {
  return {
    id: "draw-1",
    public_code: "ABC12345",
    title: "부산 → 서울 장거리 콜",
    origin: "부산",
    destination: "서울",
    departure_time: null,
    estimated_fare: null,
    customer_request: null,
    admin_memo: null,
    status: "open",
    start_at: "2026-05-13T05:00:00.000Z",
    end_at: "2026-05-13T05:03:00.000Z",
    duration_seconds: 180,
    winner_participant_id: null,
    created_by: null,
    created_at: "2026-05-13T04:59:00.000Z",
    updated_at: "2026-05-13T04:59:00.000Z",
    drawn_at: null,
    cancelled_at: null,
    ...overrides
  };
}

function createParticipant(id: string, name: string): ParticipantRow {
  return {
    id,
    draw_id: "draw-1",
    name,
    phone_last4: null,
    joined_at: "2026-05-13T05:01:00.000Z",
    user_agent_hash: null,
    is_winner: false
  };
}

function createFakeRepository(drawInput: DrawRow, participantsInput: ParticipantRow[]) {
  let draw = { ...drawInput };
  let participants = participantsInput.map((participant) => ({ ...participant }));
  let completeCalls = 0;

  const repository: DrawFinalizerRepository & { completeCalls: () => number; winners: () => ParticipantRow[] } = {
    async getDraw() {
      return { ...draw };
    },
    async claimDrawForFinalizing(_drawId, nowIso) {
      if (
        (draw.status === "open" || draw.status === "scheduled") &&
        new Date(draw.end_at).getTime() <= new Date(nowIso).getTime() &&
        !draw.winner_participant_id
      ) {
        draw = { ...draw, status: "drawing", updated_at: nowIso };
        return { ...draw };
      }

      return null;
    },
    async listParticipants() {
      return participants.map((participant) => ({ ...participant }));
    },
    async completeWithWinner(_drawId, winnerParticipantId) {
      completeCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      participants = participants.map((participant) => ({
        ...participant,
        is_winner: participant.id === winnerParticipantId
      }));
      draw = {
        ...draw,
        status: "completed",
        winner_participant_id: winnerParticipantId,
        drawn_at: "2026-05-13T05:03:01.000Z"
      };
    },
    async completeWithoutWinner() {
      completeCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      draw = {
        ...draw,
        status: "completed",
        winner_participant_id: null,
        drawn_at: "2026-05-13T05:03:01.000Z"
      };
    },
    async getFinalizeResult() {
      const winner = participants.find((participant) => participant.id === draw.winner_participant_id) ?? null;
      return {
        outcome: draw.status === "completed" ? "already_completed" : "in_progress",
        draw: { ...draw },
        participantCount: participants.length,
        winner,
        message: "현재 상태를 확인했습니다."
      };
    },
    completeCalls() {
      return completeCalls;
    },
    winners() {
      return participants.filter((participant) => participant.is_winner);
    }
  };

  return repository;
}

describe("draw finalizer", () => {
  it("completes without a winner when there are no participants", async () => {
    const repository = createFakeRepository(createDraw(), []);
    const result = await finalizeDraw(repository, "draw-1", {
      now: new Date("2026-05-13T05:03:01.000Z"),
      randomInt: () => 0
    });

    expect(result.outcome).toBe("completed");
    expect(result.winner).toBeNull();
    expect(result.draw?.status).toBe("completed");
    expect(repository.completeCalls()).toBe(1);
  });

  it("stores one winner when several finalize calls run at the same time", async () => {
    const repository = createFakeRepository(createDraw(), [
      createParticipant("p1", "홍길동"),
      createParticipant("p2", "김기사"),
      createParticipant("p3", "박기사")
    ]);

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        finalizeDraw(repository, "draw-1", {
          now: new Date("2026-05-13T05:03:01.000Z"),
          randomInt: () => 1,
          pollAttempts: 50,
          pollMs: 1
        })
      )
    );

    expect(repository.completeCalls()).toBe(1);
    expect(repository.winners()).toHaveLength(1);
    expect(repository.winners()[0].id).toBe("p2");
    expect(results.every((result) => result.draw?.winner_participant_id === "p2")).toBe(true);
  });
});
