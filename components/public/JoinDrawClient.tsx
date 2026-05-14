"use client";

import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AlertCircle, Banknote, CheckCircle2, Clock3, MapPin, Trophy, Users } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { formatCountdown, formatDateTimeKo, formatPlainText } from "@/lib/time";
import type { PublicDrawState } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ApiResponse = {
  ok: boolean;
  message?: string;
  data?: PublicDrawState;
};

function storageKey(publicCode: string) {
  return `busan-call-taxi-draw:${publicCode}`;
}

function readStoredParticipantId(publicCode: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(publicCode));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { participantId?: string };
    return parsed.participantId ?? null;
  } catch {
    return null;
  }
}

function useRemainingSeconds(endAt?: string, serverNow?: string) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endAt || !serverNow) {
      return;
    }

    const offset = new Date(serverNow).getTime() - Date.now();
    const update = () => {
      setRemaining(
        Math.max(0, Math.ceil((new Date(endAt).getTime() - (Date.now() + offset)) / 1000))
      );
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [endAt, serverNow]);

  return remaining;
}

function LotteryMachine({ state }: { state: PublicDrawState }) {
  const participants = state.publicParticipants ?? [];
  const visibleParticipants = participants.slice(-12);
  const completed = state.draw.status === "completed";
  const winnerParticipant = participants.find((participant) => participant.isWinner);
  const winnerName = state.draw.winnerName ?? winnerParticipant?.name ?? null;

  return (
    <section className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">추첨 공</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            참여하면 닉네임 공이 추가됩니다.
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700 ring-1 ring-blue-100">
          {participants.length}개
        </span>
      </div>

      <div className="lottery-stage mt-4">
        <div className={`lottery-drum ${completed ? "is-finished" : "is-spinning"}`}>
          {visibleParticipants.length > 0 ? (
            visibleParticipants.map((participant, index) => {
              const angle = `${(360 / visibleParticipants.length) * index}deg`;
              return (
                <div
                  key={participant.id}
                  className={`lottery-ball ${participant.isWinner ? "is-winner" : ""}`}
                  style={
                    {
                      "--ball-angle": angle,
                      "--ball-delay": `${index * -0.32}s`
                    } as CSSProperties
                  }
                >
                  <span>{participant.name}</span>
                </div>
              );
            })
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-sm font-bold leading-6 text-slate-500">
              아직 참여자가 없습니다.
            </div>
          )}
        </div>

        {completed && winnerName ? (
          <div className="winner-chute" aria-live="polite">
            <div className="winner-ball">
              <span>{winnerName}</span>
            </div>
            <p className="text-sm font-black text-amber-700">당첨 공</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function JoinDrawClient({ publicCode }: { publicCode: string }) {
  const [state, setState] = useState<PublicDrawState | null>(null);
  const [nickname, setNickname] = useState("");
  const [vehicleLast4, setVehicleLast4] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const finalizingRef = useRef(false);
  const remaining = useRemainingSeconds(state?.draw.endAt, state?.serverNow);

  const refresh = useCallback(async () => {
    const participantId = readStoredParticipantId(publicCode);
    const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
    const response = await fetch(`/api/public/draw/${publicCode}${query}`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as ApiResponse;

    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.message || "참여 링크를 불러오지 못했습니다.");
    }

    setState(payload.data);
    if (payload.data.viewerParticipant) {
      setNickname(payload.data.viewerParticipant.name);
      setVehicleLast4(payload.data.viewerParticipant.phoneLast4 ?? "");
    }
  }, [publicCode]);

  useEffect(() => {
    let mounted = true;
    refresh()
      .catch((caught) => {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "참여 링크를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!state?.draw.id) {
      return;
    }

    let supabase;
    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`public-draw-${state.draw.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draws", filter: `id=eq.${state.draw.id}` },
        () => refresh().catch(() => undefined)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `draw_id=eq.${state.draw.id}`
        },
        () => refresh().catch(() => undefined)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, state?.draw.id]);

  useEffect(() => {
    if (!state || remaining > 0 || finalizingRef.current) {
      return;
    }

    if (state.draw.status !== "open" && state.draw.status !== "scheduled") {
      return;
    }

    finalizingRef.current = true;
    const participantId = readStoredParticipantId(publicCode);
    fetch(`/api/public/draw/${publicCode}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId })
    })
      .then(async (response) => {
        const payload = (await response.json()) as ApiResponse;
        if (payload.data) {
          setState(payload.data);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        finalizingRef.current = false;
      });
  }, [publicCode, remaining, state]);

  const canJoin = useMemo(() => {
    return state?.draw.status === "open" && remaining > 0 && !state.viewerParticipant;
  }, [remaining, state]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (readStoredParticipantId(publicCode) && state?.viewerParticipant) {
      setNotice("이미 참여가 완료되었습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/draw/${publicCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          vehicleLast4,
          name: nickname,
          phoneLast4: vehicleLast4
        })
      });
      const payload = (await response.json()) as ApiResponse & { alreadyJoined?: boolean };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message || "참여 신청에 실패했습니다.");
      }

      setState(payload.data);
      const participant = payload.data.viewerParticipant;
      if (participant) {
        window.localStorage.setItem(
          storageKey(publicCode),
          JSON.stringify({
            participantId: participant.id,
            nickname: participant.name,
            vehicleLast4: participant.phoneLast4,
            joinedAt: participant.joinedAt
          })
        );
      }
      setNotice(payload.message ?? "참여가 완료되었습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "참여 신청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="text-center text-base font-bold text-slate-600">참여 화면을 불러오는 중입니다.</div>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-lg bg-white p-5 text-center shadow-soft ring-1 ring-slate-200">
          <AlertCircle className="mx-auto text-rose-600" size={34} aria-hidden />
          <h1 className="mt-3 text-xl font-black text-slate-950">참여할 수 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
        </section>
      </main>
    );
  }

  if (!state) {
    return null;
  }

  const viewer = state.viewerParticipant;
  const completed = state.draw.status === "completed";
  const noParticipantsCompleted = completed && !state.draw.winnerName;
  const viewerWon = completed && viewer && viewer.id === state.draw.winnerParticipantId;

  return (
    <main className="min-h-dvh bg-slate-50 pb-28">
      <div className="mx-auto w-full max-w-md px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-brand-600">장거리전문부산콜택시</p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950">
              배차 추첨 참여
            </h1>
          </div>
          <StatusBadge status={state.draw.status} />
        </div>

        <section className="mt-5 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
          <h2 className="text-xl font-black leading-snug text-slate-950">{state.draw.title}</h2>
          <div className="mt-4 space-y-3 text-base text-slate-700">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 shrink-0 text-brand-600" size={20} aria-hidden />
              <p className="min-w-0 font-bold">
                {state.draw.origin} <span className="text-slate-400">→</span> {state.draw.destination}
              </p>
            </div>
            <div className="flex gap-2">
              <Clock3 className="mt-0.5 shrink-0 text-brand-600" size={20} aria-hidden />
              <p>출발 예정: {formatPlainText(state.draw.departureTime)}</p>
            </div>
            {state.draw.estimatedFare ? (
              <div className="flex gap-2">
                <Banknote className="mt-0.5 shrink-0 text-brand-600" size={20} aria-hidden />
                <p>요금: {state.draw.estimatedFare}</p>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Users className="mt-0.5 shrink-0 text-brand-600" size={20} aria-hidden />
              <p>현재 참여자 {state.participantCount}명</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-brand-50 p-4 text-center ring-1 ring-blue-100">
            <p className="text-sm font-bold text-brand-700">남은 시간</p>
            <p className="mt-1 text-5xl font-black tracking-normal text-brand-700">
              {state.draw.status === "open" || state.draw.status === "scheduled"
                ? formatCountdown(remaining)
                : "0:00"}
            </p>
          </div>
        </section>

        <LotteryMachine state={state} />

        {viewer ? (
          <section className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <CheckCircle2 className="text-emerald-600" size={30} aria-hidden />
            <h2 className="mt-3 text-xl font-black text-slate-950">참여가 완료되었습니다</h2>
            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-slate-500">닉네임</dt>
                <dd className="font-black text-slate-950">{viewer.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-slate-500">접수 시간</dt>
                <dd className="text-right">{formatDateTimeKo(viewer.joinedAt)}</dd>
              </div>
            </dl>
            {!completed ? (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-sm font-semibold leading-6 text-slate-600">
                추첨 결과를 기다리고 있습니다. 화면을 닫아도 같은 브라우저에서는 접수 내역이 유지됩니다.
              </p>
            ) : null}
          </section>
        ) : null}

        {completed ? (
          <section className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <Trophy className="text-amber-500" size={32} aria-hidden />
            <h2 className="mt-3 text-xl font-black text-slate-950">추첨 결과</h2>
            <p className="mt-3 text-base font-bold leading-7 text-slate-700">
              {noParticipantsCompleted
                ? "참여자 없음으로 마감되었습니다."
                : viewerWon
                  ? "축하합니다. 배정되었습니다."
                  : "이번 의뢰는 다른 기사님께 배정되었습니다."}
            </p>
            {state.draw.winnerName ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-base font-black text-amber-800 ring-1 ring-amber-100">
                당첨자: {state.draw.winnerName}
              </p>
            ) : null}
          </section>
        ) : null}

        {state.draw.status === "cancelled" ? (
          <section className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-rose-100">
            <h2 className="text-xl font-black text-rose-700">취소된 추첨입니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              관리자에 의해 의뢰가 취소되어 더 이상 참여할 수 없습니다.
            </p>
          </section>
        ) : null}

        {!viewer && !completed && state.draw.status !== "cancelled" ? (
          <form onSubmit={onSubmit} className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <label className="block">
              <span className="mb-1.5 block text-sm font-black text-slate-800">닉네임</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-3 text-base font-semibold focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                placeholder="사용할 닉네임"
                autoComplete="nickname"
                disabled={!canJoin || submitting}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-black text-slate-800">
                차량번호 뒤 4자리 <span className="font-semibold text-slate-500">선택</span>
              </span>
              <input
                value={vehicleLast4}
                onChange={(event) => setVehicleLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-3 text-base font-semibold focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                placeholder="예: 1234"
                inputMode="numeric"
                maxLength={4}
                disabled={!canJoin || submitting}
              />
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                같은 닉네임 구분을 위해 가능하면 입력해 주세요.
              </span>
            </label>
            {error ? <p className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
            {notice ? <p className="mt-3 text-sm font-bold text-emerald-700">{notice}</p> : null}
          </form>
        ) : null}
      </div>

      {!viewer && !completed && state.draw.status !== "cancelled" ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <button
              type="button"
              onClick={(event) => {
                const form = document.querySelector("form");
                if (form) {
                  event.preventDefault();
                  form.requestSubmit();
                }
              }}
              disabled={!canJoin || submitting}
              className="flex min-h-14 w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-3 text-lg font-black text-white shadow-lg transition hover:bg-brand-700 disabled:bg-slate-300"
            >
              {submitting ? "접수 중" : canJoin ? "추첨 참여하기" : "참여할 수 없습니다"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
