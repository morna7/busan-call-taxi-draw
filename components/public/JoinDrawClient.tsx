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
import {
  AlertCircle,
  Banknote,
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  Trophy,
  Users
} from "lucide-react";
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

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) {
        break;
      }
    } else {
      line = testLine;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  lines.forEach((lineText, index) => {
    context.fillText(lineText, x, y + index * lineHeight);
  });
}

async function canvasToPngBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("결과 이미지를 만들지 못했습니다.");
  }

  return blob;
}

function isMobileLikeBrowser() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

function isKakaoInAppBrowser() {
  return /KAKAOTALK|KakaoTalk/i.test(navigator.userAgent);
}

function createResultTextForPublicDraw(state: PublicDrawState) {
  return [
    "[장거리전문부산콜택시 배차 추첨 결과]",
    `의뢰: ${state.draw.title}`,
    `출발지: ${state.draw.origin}`,
    `도착지: ${state.draw.destination}`,
    `출발 예정: ${formatPlainText(state.draw.departureTime)}`,
    state.draw.estimatedFare ? `요금: ${state.draw.estimatedFare}` : null,
    `참여자 수: ${state.participantCount}명`,
    `당첨자: ${state.draw.winnerName ?? "참여자 없음"}`,
    `추첨 완료 시간: ${formatDateTimeKo(state.draw.drawnAt)}`
  ]
    .filter(Boolean)
    .join("\n");
}

function openCurrentPageInExternalBrowser() {
  const url = window.location.href;

  if (/Android/i.test(navigator.userAgent)) {
    const withoutScheme = url.replace(/^https?:\/\//, "");
    window.location.href = `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function downloadResultImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "busan-call-taxi-draw-result.png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareResultImage(file: File) {
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    return false;
  }

  await navigator.share({
    title: "장거리전문부산콜택시 배차 추첨 결과",
    text: "배차 추첨 결과 이미지입니다.",
    files: [file]
  });

  return true;
}

async function copyResultCanvasToClipboard(canvas: HTMLCanvasElement) {
  const blob = await canvasToPngBlob(canvas);
  const file = new File([blob], "busan-call-taxi-draw-result.png", { type: "image/png" });

  if (isMobileLikeBrowser()) {
    const shared = await shareResultImage(file);
    if (shared) {
      return "공유창이 열렸습니다. 카카오톡을 선택해서 결과 이미지를 보낼 수 있습니다.";
    }
  }

  if ("ClipboardItem" in window && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "결과 이미지가 복사되었습니다. 카카오톡 등에 바로 붙여넣을 수 있습니다.";
    } catch (error) {
      if ((error as Error).name === "NotAllowedError" && isMobileLikeBrowser()) {
        const shared = await shareResultImage(file);
        if (shared) {
          return "공유창이 열렸습니다. 카카오톡을 선택해서 결과 이미지를 보낼 수 있습니다.";
        }
      }
    }
  }

  const shared = await shareResultImage(file);
  if (shared) {
    return "공유창이 열렸습니다. 카카오톡을 선택해서 결과 이미지를 보낼 수 있습니다.";
  }

  downloadResultImage(blob);
  return "이미지 복사를 지원하지 않는 브라우저라 결과 이미지를 다운로드했습니다.";
}

function LotteryMachine({ state }: { state: PublicDrawState }) {
  const participants = state.publicParticipants ?? [];
  const visibleParticipants = participants.slice(-12);
  const completed = state.draw.status === "completed";
  const winnerParticipant = participants.find((participant) => participant.isWinner);
  const winnerName = state.draw.winnerName ?? winnerParticipant?.name ?? null;

  return (
    <section className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80">
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
        {completed && winnerName ? (
          <div className="winner-showcase" aria-live="polite">
            <div className="winner-rays" />
            <div className="winner-ball is-featured">
              <span>{winnerName}</span>
            </div>
            <p className="winner-label">당첨 공</p>
          </div>
        ) : (
          <div className="lottery-drum is-spinning">
            {visibleParticipants.length > 0 ? (
              visibleParticipants.map((participant, index) => {
                const angle = `${(360 / visibleParticipants.length) * index}deg`;
                return (
                  <div
                    key={participant.id}
                    className="lottery-ball"
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
        )}

        {completed && !winnerName ? (
          <div className="flex h-full min-h-64 items-center justify-center px-8 text-center text-sm font-bold leading-6 text-slate-500">
            참여자 없음으로 마감되었습니다.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ResultCopyButton({ state }: { state: PublicDrawState }) {
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  function setPreviewBlob(blob: Blob) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    previewBlobRef.current = blob;
    setPreviewUrl(URL.createObjectURL(blob));
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function onCopyResultImage() {
    setCopying(true);
    setMessage(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1320;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("결과 이미지를 만들지 못했습니다.");
      }

      context.fillStyle = "#f8fafc";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "#1d4ed8";
      context.fillRect(0, 0, canvas.width, 230);

      context.fillStyle = "#ffffff";
      context.font = "800 34px Arial, Malgun Gothic, sans-serif";
      context.fillText("장거리전문부산콜택시", 72, 82);
      context.font = "900 58px Arial, Malgun Gothic, sans-serif";
      context.fillText("배차 추첨 결과", 72, 160);

      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(902, 120, 72, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f59e0b";
      context.beginPath();
      context.arc(902, 120, 58, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#78350f";
      context.font = "900 26px Arial, Malgun Gothic, sans-serif";
      context.textAlign = "center";
      context.fillText("당첨", 902, 113);
      context.fillText("공", 902, 145);
      context.textAlign = "left";

      context.fillStyle = "#ffffff";
      context.strokeStyle = "#dbeafe";
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(60, 280, 960, 920, 32);
      context.fill();
      context.stroke();

      context.fillStyle = "#0f172a";
      context.font = "900 48px Arial, Malgun Gothic, sans-serif";
      drawWrappedText(context, state.draw.title, 108, 370, 840, 58, 2);

      context.font = "700 34px Arial, Malgun Gothic, sans-serif";
      context.fillStyle = "#334155";
      context.fillText(`출발지: ${state.draw.origin}`, 108, 505);
      context.fillText(`도착지: ${state.draw.destination}`, 108, 570);
      context.fillText(`출발 예정: ${formatPlainText(state.draw.departureTime)}`, 108, 635);

      if (state.draw.estimatedFare) {
        context.fillText(`요금: ${state.draw.estimatedFare}`, 108, 700);
      }

      context.fillText(`참여자 수: ${state.participantCount}명`, 108, 765);

      context.fillStyle = "#fef3c7";
      context.beginPath();
      context.roundRect(108, 825, 864, 150, 26);
      context.fill();

      context.fillStyle = "#92400e";
      context.font = "900 34px Arial, Malgun Gothic, sans-serif";
      context.fillText("당첨자", 150, 882);
      context.font = "900 56px Arial, Malgun Gothic, sans-serif";
      context.fillText(state.draw.winnerName ?? "참여자 없음", 150, 945);

      context.fillStyle = "#475569";
      context.font = "700 30px Arial, Malgun Gothic, sans-serif";
      context.fillText(`추첨 완료 시간: ${formatDateTimeKo(state.draw.drawnAt)}`, 108, 1065);

      if (state.draw.customerRequest) {
        context.fillStyle = "#64748b";
        context.font = "700 26px Arial, Malgun Gothic, sans-serif";
        context.fillText("고객 요청사항", 108, 1135);
        context.font = "600 25px Arial, Malgun Gothic, sans-serif";
        drawWrappedText(context, state.draw.customerRequest, 108, 1180, 850, 36, 2);
      }

      const blob = await canvasToPngBlob(canvas);

      if (isKakaoInAppBrowser()) {
        setPreviewBlob(blob);

        try {
          await navigator.clipboard?.writeText(createResultTextForPublicDraw(state));
        } catch {
          // Kakao in-app browser often blocks clipboard writes. The image preview remains available.
        }

        setMessage(
          "카카오톡 내부 브라우저는 이미지 복사/공유가 제한됩니다. 아래 이미지를 길게 눌러 저장하거나, 외부 브라우저로 열어서 공유해 주세요."
        );
        return;
      }

      const resultMessage = await copyResultCanvasToClipboard(canvas);
      setMessage(resultMessage);
    } catch (caught) {
      setMessage(
        caught instanceof Error && caught.name === "AbortError"
          ? "이미지 공유를 취소했습니다."
          : caught instanceof Error
            ? caught.message
            : "결과 이미지 복사에 실패했습니다."
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onCopyResultImage}
        disabled={copying}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:bg-slate-300"
      >
        <Camera size={19} aria-hidden />
        {copying ? "이미지 준비 중" : "추첨 결과 이미지 복사/공유"}
      </button>
      {message ? (
        <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold leading-5 text-slate-600">
          {message}
        </p>
      ) : null}
      {previewUrl ? (
        <div className="mt-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
          {/* Blob URLs cannot be optimized by next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="추첨 결과 이미지 미리보기"
            className="w-full rounded-xl bg-white shadow-sm ring-1 ring-amber-100"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (previewBlobRef.current) {
                  downloadResultImage(previewBlobRef.current);
                }
              }}
              className="min-h-11 rounded-xl bg-white px-3 text-sm font-black text-slate-800 ring-1 ring-amber-200"
            >
              이미지 저장
            </button>
            <button
              type="button"
              onClick={openCurrentPageInExternalBrowser}
              className="min-h-11 rounded-xl bg-slate-950 px-3 text-sm font-black text-white"
            >
              외부 브라우저
            </button>
          </div>
          <p className="mt-2 text-xs font-bold leading-5 text-amber-800">
            카카오톡 안에서는 이미지를 직접 붙여넣기 어렵습니다. 이미지를 저장한 뒤 채팅방에서 사진으로 첨부하거나 외부 브라우저에서 공유해 주세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ResultSection({
  state,
  noParticipantsCompleted,
  viewerWon
}: {
  state: PublicDrawState;
  noParticipantsCompleted: boolean;
  viewerWon: boolean | null;
}) {
  return (
    <section className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80">
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
        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-3 text-base font-black text-amber-800 ring-1 ring-amber-100">
          당첨자: {state.draw.winnerName}
        </p>
      ) : null}
      <ResultCopyButton state={state} />
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
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="text-center text-base font-bold text-slate-600">참여 화면을 불러오는 중입니다.</div>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-card ring-1 ring-slate-200/80">
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
  const isScheduled = state.draw.status === "scheduled";
  const timePanelLabel = isScheduled ? "참여 시작 시간" : "남은 시간";
  const timePanelValue = isScheduled
    ? formatDateTimeKo(state.draw.startAt)
    : state.draw.status === "open"
      ? formatCountdown(remaining)
      : "0:00";
  const joinButtonLabel = submitting
    ? "접수 중"
    : canJoin
      ? "추첨 참여하기"
      : isScheduled
        ? "참여 시작시간에 참여가능합니다."
        : "참여할 수 없습니다";

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-md px-4 py-5">
        <div className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-slate-950 p-5 text-white shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-blue-200">장거리전문부산콜택시</p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-white">
              배차 추첨 참여
            </h1>
          </div>
          <StatusBadge status={state.draw.status} />
        </div>
        </div>

        <section className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80">
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

          <div className="mt-5 rounded-3xl bg-gradient-to-br from-brand-50 to-blue-100 p-4 text-center ring-1 ring-blue-100">
            <p className="text-sm font-bold text-brand-700">{timePanelLabel}</p>
            <p
              className={`mt-1 font-black tracking-normal text-brand-700 ${
                isScheduled ? "text-2xl leading-tight" : "text-5xl"
              }`}
            >
              {timePanelValue}
            </p>
          </div>
        </section>

        <LotteryMachine state={state} />

        {viewer ? (
          <section className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80">
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
          <ResultSection
            state={state}
            noParticipantsCompleted={noParticipantsCompleted}
            viewerWon={viewerWon}
          />
        ) : null}

        {state.draw.status === "cancelled" ? (
          <section className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-rose-100">
            <h2 className="text-xl font-black text-rose-700">취소된 추첨입니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              관리자에 의해 의뢰가 취소되어 더 이상 참여할 수 없습니다.
            </p>
          </section>
        ) : null}

        {!viewer && !completed && state.draw.status !== "cancelled" ? (
          <form onSubmit={onSubmit} className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80">
            <label className="block">
              <span className="mb-1.5 block text-sm font-black text-slate-800">닉네임</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-base font-semibold focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-base font-semibold focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                placeholder="예: 1234"
                inputMode="numeric"
                maxLength={4}
                disabled={!canJoin || submitting}
              />
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                같은 닉네임 구분을 위해 가능하면 입력해 주세요.
              </span>
            </label>
            {state.draw.customerRequest ? (
              <section className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <h3 className="text-sm font-black text-brand-700">고객 요청사항</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                  {state.draw.customerRequest}
                </p>
              </section>
            ) : null}
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
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-brand-600 to-brand-700 px-4 py-3 text-lg font-black text-white shadow-lift transition hover:from-brand-500 hover:to-brand-700 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            >
              {joinButtonLabel}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
