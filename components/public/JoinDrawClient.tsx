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
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  Trophy,
  Users,
  XCircle
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

function drawShareResultConfetti(context: CanvasRenderingContext2D) {
  const pieces = [
    [94, 250, "#f59e0b", 0.2],
    [190, 210, "#38bdf8", -0.4],
    [346, 250, "#22c55e", 0.5],
    [760, 230, "#f43f5e", -0.2],
    [930, 278, "#facc15", 0.4],
    [844, 1090, "#60a5fa", -0.5],
    [154, 1125, "#fb7185", 0.3],
    [945, 1015, "#34d399", 0.2]
  ] as const;

  pieces.forEach(([x, y, color, rotate]) => {
    context.save();
    context.translate(x, y);
    context.rotate(rotate);
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(-15, -7, 30, 14, 5);
    context.fill();
    context.restore();
  });
}

function drawShareDriverCharacter(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.translate(x, y);

  context.fillStyle = "#dbeafe";
  context.beginPath();
  context.roundRect(-96, 118, 220, 34, 17);
  context.fill();

  context.fillStyle = "#1f7ae0";
  context.beginPath();
  context.roundRect(-70, 36, 135, 98, 30);
  context.fill();

  context.fillStyle = "#f8c9a6";
  context.beginPath();
  context.arc(0, -12, 54, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#0f172a";
  context.beginPath();
  context.arc(-16, -18, 5, 0, Math.PI * 2);
  context.arc(20, -18, 5, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#0f172a";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.arc(4, 0, 20, 0.22 * Math.PI, 0.78 * Math.PI);
  context.stroke();

  context.fillStyle = "#123f79";
  context.beginPath();
  context.arc(0, -54, 55, Math.PI, Math.PI * 2);
  context.lineTo(56, -42);
  context.lineTo(-56, -42);
  context.closePath();
  context.fill();

  context.fillStyle = "#facc15";
  context.beginPath();
  context.roundRect(-38, -73, 76, 24, 12);
  context.fill();

  context.fillStyle = "#123f79";
  context.font = "900 18px Arial, Malgun Gothic, sans-serif";
  context.textAlign = "center";
  context.fillText("TAXI", 0, -55);

  context.strokeStyle = "#f8c9a6";
  context.lineWidth = 22;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(58, 58);
  context.lineTo(112, 15);
  context.stroke();

  context.fillStyle = "#f8c9a6";
  context.beginPath();
  context.arc(124, 0, 20, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f8c9a6";
  context.beginPath();
  context.roundRect(116, -38, 18, 46, 9);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "900 24px Arial, Malgun Gothic, sans-serif";
  context.fillText("GOOD", 0, 96);
  context.textAlign = "left";
  context.restore();
}

function drawShareResultImage(context: CanvasRenderingContext2D, state: PublicDrawState) {
  context.fillStyle = "#f7fafc";
  context.fillRect(0, 0, 1080, 1320);

  const headerGradient = context.createLinearGradient(0, 0, 1080, 280);
  headerGradient.addColorStop(0, "#15539e");
  headerGradient.addColorStop(0.58, "#1d4ed8");
  headerGradient.addColorStop(1, "#0f172a");
  context.fillStyle = headerGradient;
  context.fillRect(0, 0, 1080, 285);

  drawShareResultConfetti(context);

  context.fillStyle = "rgba(255,255,255,0.18)";
  context.beginPath();
  context.arc(930, 96, 92, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "800 35px Arial, Malgun Gothic, sans-serif";
  context.fillText("장거리전문부산콜택시", 72, 82);
  context.font = "900 64px Arial, Malgun Gothic, sans-serif";
  context.fillText("배차 추첨 결과", 72, 166);
  context.font = "800 28px Arial, Malgun Gothic, sans-serif";
  context.fillStyle = "#dbeafe";
  context.fillText("공정 추첨으로 배정이 완료되었습니다.", 72, 218);

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(902, 132, 78, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f59e0b";
  context.beginPath();
  context.arc(902, 132, 62, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#78350f";
  context.font = "900 28px Arial, Malgun Gothic, sans-serif";
  context.textAlign = "center";
  context.fillText("당첨", 902, 125);
  context.fillText("공", 902, 159);
  context.textAlign = "left";

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#dbeafe";
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(58, 330, 964, 850, 38);
  context.fill();
  context.stroke();

  context.fillStyle = "#0f172a";
  context.font = "900 52px Arial, Malgun Gothic, sans-serif";
  drawWrappedText(context, state.draw.title, 108, 410, 610, 60, 2);

  drawShareDriverCharacter(context, 835, 520);

  context.font = "800 33px Arial, Malgun Gothic, sans-serif";
  context.fillStyle = "#334155";
  context.fillText(`출발지: ${state.draw.origin}`, 108, 560);
  context.fillText(`도착지: ${state.draw.destination}`, 108, 622);
  context.fillText(`출발 예정: ${formatPlainText(state.draw.departureTime)}`, 108, 684);
  if (state.draw.estimatedFare) {
    context.fillText(`요금: ${state.draw.estimatedFare}`, 108, 746);
  }
  context.fillText(`참여자 수: ${state.participantCount}명`, 108, 808);

  const winnerGradient = context.createLinearGradient(108, 858, 972, 1055);
  winnerGradient.addColorStop(0, "#fff7cc");
  winnerGradient.addColorStop(0.45, "#fef3c7");
  winnerGradient.addColorStop(1, "#f59e0b");
  context.fillStyle = winnerGradient;
  context.beginPath();
  context.roundRect(108, 858, 864, 190, 32);
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.58)";
  context.beginPath();
  context.arc(885, 920, 70, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#92400e";
  context.font = "900 34px Arial, Malgun Gothic, sans-serif";
  context.fillText("당첨자", 150, 925);
  context.font = "900 76px Arial, Malgun Gothic, sans-serif";
  drawWrappedText(context, state.draw.winnerName ?? "참여자 없음", 150, 1000, 700, 76, 1);

  context.fillStyle = "#475569";
  context.font = "800 29px Arial, Malgun Gothic, sans-serif";
  context.fillText(`추첨 완료 시간: ${formatDateTimeKo(state.draw.drawnAt)}`, 108, 1125);

  if (state.draw.customerRequest) {
    context.fillStyle = "#64748b";
    context.font = "700 24px Arial, Malgun Gothic, sans-serif";
    context.fillText("고객 요청사항", 108, 1218);
    context.font = "600 23px Arial, Malgun Gothic, sans-serif";
    drawWrappedText(context, state.draw.customerRequest, 108, 1260, 850, 34, 2);
  }
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

      drawShareResultImage(context, state);

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
          <button
            type="button"
            onClick={openCurrentPageInExternalBrowser}
            className="mt-3 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm font-black text-white"
          >
            외부 브라우저에서 열기
          </button>
          <p className="mt-2 text-xs font-bold leading-5 text-amber-800">
            카카오톡 안에서는 이미지 복사/공유가 제한됩니다. 외부 브라우저에서 연 뒤 다시 `추첨 결과 이미지 복사/공유` 버튼을 눌러 공유해 주세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function TaxiDriverThumbsUp() {
  return (
    <div className="result-driver-figure" aria-hidden>
      <svg viewBox="0 0 220 220" className="h-full w-full">
        <ellipse cx="112" cy="194" rx="74" ry="14" fill="#dbeafe" opacity="0.8" />
        <path
          d="M59 118c0-30 24-54 54-54s54 24 54 54v46H59v-46Z"
          fill="#1f7ae0"
        />
        <path d="M68 121h90v43H68z" fill="#1767c3" opacity="0.7" />
        <circle cx="112" cy="76" r="43" fill="#f8c9a6" />
        <path
          d="M69 62c8-29 31-42 63-33 22 6 37 20 42 42-30-12-69-13-105-9Z"
          fill="#123f79"
        />
        <rect x="82" y="25" width="62" height="23" rx="11.5" fill="#facc15" />
        <text x="113" y="42" textAnchor="middle" fontSize="15" fontWeight="900" fill="#123f79">
          TAXI
        </text>
        <circle cx="98" cy="77" r="4.5" fill="#0f172a" />
        <circle cx="126" cy="77" r="4.5" fill="#0f172a" />
        <path d="M96 96c10 12 25 12 35 0" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
        <path d="M154 118c18-5 31-17 42-37" fill="none" stroke="#f8c9a6" strokeWidth="18" strokeLinecap="round" />
        <circle cx="200" cy="72" r="15" fill="#f8c9a6" />
        <rect x="195" y="38" width="15" height="40" rx="7.5" fill="#f8c9a6" />
        <path d="M74 139h76" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
        <path d="M88 158h48" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.75" />
      </svg>
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
    <section className="result-celebration-card relative mt-4 overflow-hidden rounded-3xl bg-white p-5 shadow-card ring-1 ring-amber-100">
      <div className="result-confetti" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
            <Trophy size={14} aria-hidden />
            배차 확정
          </span>
          <h2 className="mt-3 text-2xl font-black text-slate-950">추첨 결과</h2>
          <p className="mt-2 text-base font-bold leading-7 text-slate-700">
            {noParticipantsCompleted
              ? "참여자 없음으로 마감되었습니다."
              : viewerWon
                ? "축하합니다. 배정되었습니다."
                : "이번 의뢰는 다른 기사님께 배정되었습니다."}
          </p>
        </div>
        {!noParticipantsCompleted ? <TaxiDriverThumbsUp /> : null}
      </div>

      {state.draw.winnerName ? (
        <div className="relative z-10 mt-5 rounded-3xl bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-300 p-5 shadow-sm ring-1 ring-amber-200">
          <div className="absolute right-4 top-4 h-20 w-20 rounded-full bg-white/45 blur-sm" aria-hidden />
          <p className="relative text-sm font-black text-amber-900">당첨자 닉네임</p>
          <p className="relative mt-2 break-words text-5xl font-black leading-none tracking-normal text-amber-950">
            {state.draw.winnerName}
          </p>
          <p className="relative mt-3 text-sm font-black text-amber-800">
            담당 기사님으로 배정되었습니다.
          </p>
        </div>
      ) : (
        <div className="relative z-10 mt-5 rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <p className="text-2xl font-black text-slate-800">참여자 없음</p>
          <p className="mt-2 text-sm font-bold text-slate-500">이번 의뢰는 당첨자 없이 마감되었습니다.</p>
        </div>
      )}

      <div className="relative z-10 mt-4 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="text-xs font-black text-slate-500">추첨 완료 시간</p>
        <p className="mt-1 text-sm font-black text-slate-800">{formatDateTimeKo(state.draw.drawnAt)}</p>
      </div>

      <div className="relative z-10">
        <ResultCopyButton state={state} />
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
  const [canceling, setCanceling] = useState(false);
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

  async function cancelParticipation() {
    const participantId = readStoredParticipantId(publicCode);
    if (!participantId || !state?.viewerParticipant) {
      setError("취소할 참여 내역을 찾지 못했습니다.");
      return;
    }

    if (!window.confirm("참여를 취소할까요?\n\n취소 후에는 참여 시간 안에 다시 참여할 수 있습니다.")) {
      return;
    }

    setCanceling(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/public/draw/${publicCode}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId })
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message || "참여 취소에 실패했습니다.");
      }

      window.localStorage.removeItem(storageKey(publicCode));
      setState(payload.data);
      setNotice(payload.message ?? "참여가 취소되었습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "참여 취소 중 오류가 발생했습니다.");
    } finally {
      setCanceling(false);
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
  const canCancelParticipation = Boolean(viewer) && state.draw.status === "open" && remaining > 0;
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

        <nav className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/80">
          <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-3 text-sm font-black text-white shadow-sm">
            추첨 참여
          </span>
          <Link
            href="/winners"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-black text-amber-800 transition hover:bg-amber-50"
          >
            <Trophy size={16} aria-hidden />
            명예의 전당
          </Link>
        </nav>

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
                required
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-black text-slate-800">
                차량번호 뒤 4자리
              </span>
              <input
                value={vehicleLast4}
                onChange={(event) => setVehicleLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-base font-semibold focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                placeholder="예: 1234"
                inputMode="numeric"
                maxLength={4}
                disabled={!canJoin || submitting}
                required
              />
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                참여하려면 차량번호 뒤 4자리를 반드시 입력해 주세요.
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

        <section className="mt-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80">
          <h2 className="text-xl font-black leading-snug text-slate-950">{state.draw.title}</h2>
          <div className="mt-4 space-y-3 text-base text-slate-700">
            {state.draw.destination ? (
              <div className="flex gap-2">
                <MapPin className="mt-0.5 shrink-0 text-brand-600" size={20} aria-hidden />
                <p className="min-w-0 font-bold">
                  {state.draw.origin} <span className="text-slate-400">→</span> {state.draw.destination}
                </p>
              </div>
            ) : null}
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
            {canCancelParticipation ? (
              <button
                type="button"
                onClick={cancelParticipation}
                disabled={canceling}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-base font-black text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-slate-200"
              >
                <XCircle size={19} aria-hidden />
                {canceling ? "참여 취소 중" : "참여 취소하기"}
              </button>
            ) : null}
            {error ? <p className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
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

        {state !== null &&
        state.draw.id === "__legacy_join_form_slot__" &&
        !viewer &&
        !completed &&
        state.draw.status !== "cancelled" ? (
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
                required
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-black text-slate-800">
                차량번호 뒤 4자리
              </span>
              <input
                value={vehicleLast4}
                onChange={(event) => setVehicleLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-base font-semibold focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
                placeholder="예: 1234"
                inputMode="numeric"
                maxLength={4}
                disabled={!canJoin || submitting}
                required
              />
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                참여하려면 차량번호 뒤 4자리를 반드시 입력해 주세요.
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

        <LotteryMachine state={state} />

        <a
          href="https://busantaxi.pages.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-brand-900 to-brand-700 p-5 text-white shadow-lift ring-1 ring-blue-200/40 transition hover:-translate-y-0.5 hover:shadow-card"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black text-blue-200">장거리전문부산콜택시</p>
              <p className="mt-1 text-lg font-black leading-snug">공식 홈페이지 바로가기</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-blue-100">
                장거리 콜택시 안내와 상담 정보를 확인하세요.
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <ExternalLink size={22} aria-hidden />
            </span>
          </div>
        </a>
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
