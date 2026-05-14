import { describe, expect, it } from "vitest";
import { getAdminRedirect } from "@/lib/admin-auth-rules";
import { getJoinEligibility, hasDuplicateParticipant, pickWinner } from "@/lib/draw-rules";

const openDraw = {
  status: "open" as const,
  start_at: "2026-05-13T05:00:00.000Z",
  end_at: "2026-05-13T05:03:00.000Z"
};

describe("draw participation rules", () => {
  it("allows joining inside the participation window", () => {
    const result = getJoinEligibility(openDraw, new Date("2026-05-13T05:01:00.000Z"));
    expect(result.ok).toBe(true);
  });

  it("blocks joining after endAt", () => {
    const result = getJoinEligibility(openDraw, new Date("2026-05-13T05:03:00.000Z"));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("draw_closed");
  });

  it("detects duplicate name and phone last4 inside a draw", () => {
    const participants = [
      { id: "p1", name: "홍길동", phone_last4: "1234" },
      { id: "p2", name: "김기사", phone_last4: null }
    ];

    expect(hasDuplicateParticipant(participants, " 홍길동 ", "1234")).toBe(true);
    expect(hasDuplicateParticipant(participants, "홍길동", "5678")).toBe(false);
  });

  it("selects the only participant when one participant exists", () => {
    const winner = pickWinner([{ id: "p1", name: "홍길동", phone_last4: "1234" }], () => 0);
    expect(winner?.id).toBe("p1");
  });

  it("selects exactly one participant from multiple participants", () => {
    const winner = pickWinner(
      [
        { id: "p1", name: "홍길동", phone_last4: "1234" },
        { id: "p2", name: "김기사", phone_last4: "5678" },
        { id: "p3", name: "박기사", phone_last4: null }
      ],
      () => 1
    );

    expect(winner?.id).toBe("p2");
  });
});

describe("admin auth redirect rules", () => {
  it("redirects unauthenticated admin visitors to login", () => {
    expect(getAdminRedirect("/admin", false)).toEqual({
      pathname: "/admin/login",
      next: "/admin"
    });
  });

  it("allows authenticated admin visitors", () => {
    expect(getAdminRedirect("/admin", true)).toBeNull();
  });
});
