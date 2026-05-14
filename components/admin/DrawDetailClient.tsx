"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  Ban,
  ChevronLeft,
  Copy,
  Edit3,
  ExternalLink,
  RefreshCw,
  Save,
  Trophy,
  Users
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { buildResultText } from "@/lib/result-text";
import { formatCountdown, formatDateTimeKo, toDateTimeLocalInputValue } from "@/lib/time";
import type { AdminDrawDetail } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type DetailData = {
  serverNow: string;
  draw: AdminDrawDetail;
};

type EditState = {
  title: string;
  origin: string;
  destination: string;
  departureTime: string;
  estimatedFare: string;
  customerRequest: string;
  adminMemo: string;
  durationSeconds: number;
  startAt: string;
};

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function useBrowserOrigin() {
  return useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => ""
  );
}

function remainingText(draw: AdminDrawDetail, serverOffset: number, clientNow: number) {
  if (draw.status === "completed" || draw.status === "cancelled") {
    return "-";
  }

  const remaining = Math.max(
    0,
    Math.ceil((new Date(draw.endAt).getTime() - (clientNow + serverOffset)) / 1000)
  );
  return formatCountdown(remaining);
}

function createEditState(draw: AdminDrawDetail): EditState {
  return {
    title: draw.title,
    origin: draw.origin,
    destination: draw.destination,
    departureTime: toDateTimeLocalInputValue(draw.departureTime),
    estimatedFare: draw.estimatedFare ?? "",
    customerRequest: draw.customerRequest ?? "",
    adminMemo: draw.adminMemo ?? "",
    durationSeconds: draw.durationSeconds,
    startAt: toDateTimeLocalInputValue(draw.startAt)
  };
}

export function DrawDetailClient({ initialData }: { initialData: DetailData }) {
  const [data, setData] = useState(initialData);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>(() => createEditState(initialData.draw));
  const [saving, setSaving] = useState(false);
  const [clientNow, setClientNow] = useState(() => new Date(initialData.serverNow).getTime());
  const [serverOffset, setServerOffset] = useState(0);
  const finalizing = useRef(false);
  const draw = data.draw;
  const browserOrigin = useBrowserOrigin();
  const configuredOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const siteOrigin = configuredOrigin || browserOrigin;
  const joinUrl = siteOrigin ? `${siteOrigin}/join/${draw.publicCode}` : `/join/${draw.publicCode}`;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/draws/${initialData.draw.id}`, { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data?: DetailData; message?: string };

    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.message || "상세 정보를 새로고침하지 못했습니다.");
    }

    setServerOffset(new Date(payload.data.serverNow).getTime() - Date.now());
    setData(payload.data);
  }, [initialData.draw.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setClientNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    let supabase;
    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`admin-draw-${draw.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "draws", filter: `id=eq.${draw.id}` }, () => {
        refresh().catch(() => undefined);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `draw_id=eq.${draw.id}` },
        () => {
          refresh().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [draw.id, refresh]);

  useEffect(() => {
    const approxNow = clientNow + serverOffset;

    if (
      !finalizing.current &&
      (draw.status === "open" || draw.status === "scheduled") &&
      new Date(draw.endAt).getTime() <= approxNow
    ) {
      finalizing.current = true;
      fetch(`/api/admin/draws/${draw.id}/finalize`, { method: "POST" })
        .then(() => refresh())
        .catch(() => undefined)
        .finally(() => {
          finalizing.current = false;
        });
    }
  }, [clientNow, draw.endAt, draw.id, draw.status, refresh, serverOffset]);

  const canEditCore = useMemo(() => {
    return draw.status === "scheduled" && clientNow + serverOffset < new Date(draw.startAt).getTime();
  }, [clientNow, draw.startAt, draw.status, serverOffset]);

  const winner = draw.participants.find((participant) => participant.id === draw.winnerParticipantId);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 1800);
  }

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    flash("참여 링크를 복사했습니다.");
  }

  async function copyResult() {
    await navigator.clipboard.writeText(buildResultText(draw));
    flash("추첨 결과를 복사했습니다.");
  }

  async function cancelDraw() {
    if (!window.confirm("이 의뢰를 취소할까요?")) {
      return;
    }

    setError(null);
    const response = await fetch(`/api/admin/draws/${draw.id}/cancel`, { method: "POST" });
    const payload = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.message || "취소하지 못했습니다.");
      return;
    }
    await refresh();
    flash("의뢰를 취소했습니다.");
  }

  async function finalizeNow() {
    setError(null);
    const response = await fetch(`/api/admin/draws/${draw.id}/finalize`, { method: "POST" });
    const payload = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.message || "추첨 처리를 완료하지 못했습니다.");
      return;
    }
    await refresh();
    flash(payload.message || "추첨 상태를 확인했습니다.");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/draws/${draw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...edit,
          departureTime: toIsoOrNull(edit.departureTime),
          startAt: toIsoOrNull(edit.startAt),
          startMode: "scheduled"
        })
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "수정하지 못했습니다.");
      }

      await refresh();
      setEditOpen(false);
      flash("의뢰를 수정했습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-950"
      >
        <ChevronLeft size={17} aria-hidden />
        대시보드
      </Link>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={draw.status} />
            <span className="text-sm font-bold text-slate-500">코드 {draw.publicCode}</span>
          </div>
          <h1 className="mt-2 text-2xl font-black leading-tight text-slate-950">{draw.title}</h1>
          <p className="mt-1 text-base font-semibold text-slate-600">
            {draw.origin} → {draw.destination}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="button" tone="secondary" onClick={() => refresh()} className="px-3">
            <RefreshCw size={18} aria-hidden />
            새로고침
          </PrimaryButton>
          {canEditCore ? (
            <PrimaryButton
              type="button"
              tone="secondary"
              onClick={() => {
                setEdit(createEditState(draw));
                setEditOpen((open) => !open);
              }}
              className="px-3"
            >
              <Edit3 size={18} aria-hidden />
              수정
            </PrimaryButton>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">의뢰 정보</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="font-bold text-slate-500">출발 예정 시간</dt>
              <dd className="mt-1 font-black text-slate-950">{formatDateTimeKo(draw.departureTime)}</dd>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <dt className="font-bold text-blue-700">남은 시간</dt>
              <dd className="mt-1 text-2xl font-black text-blue-700">
                {remainingText(draw, serverOffset, clientNow)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="font-bold text-slate-500">참여 시작</dt>
              <dd className="mt-1 font-black text-slate-950">{formatDateTimeKo(draw.startAt)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="font-bold text-slate-500">참여 마감</dt>
              <dd className="mt-1 font-black text-slate-950">{formatDateTimeKo(draw.endAt)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="font-bold text-slate-500">예상 요금</dt>
              <dd className="mt-1 font-black text-slate-950">{draw.estimatedFare ?? "-"}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="font-bold text-slate-500">추첨 완료 시간</dt>
              <dd className="mt-1 font-black text-slate-950">{formatDateTimeKo(draw.drawnAt)}</dd>
            </div>
          </dl>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-500">고객 요청사항</p>
              <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {draw.customerRequest ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">관리자 메모</p>
              <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {draw.adminMemo ?? "-"}
              </p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg bg-white p-5 text-center shadow-soft ring-1 ring-slate-200">
            <h2 className="text-lg font-black text-slate-950">참여 QR</h2>
            <div className="mt-4 flex justify-center">
              {siteOrigin ? (
                <QRCodeCanvas value={joinUrl} size={190} includeMargin />
              ) : (
                <div className="h-48 w-48 rounded-lg bg-slate-100" />
              )}
            </div>
            <p className="mt-3 break-all text-xs font-semibold leading-5 text-slate-500">{joinUrl}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyJoinLink}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                <Copy size={16} aria-hidden />
                링크 복사
              </button>
              <Link
                href={`/join/${draw.publicCode}`}
                target="_blank"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <ExternalLink size={16} aria-hidden />
                열기
              </Link>
            </div>
          </section>

          <section className="rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <Trophy size={21} className="text-amber-500" aria-hidden />
              결과
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              당첨자: <span className="font-black text-slate-950">{winner?.name ?? "없음"}</span>
            </p>
            <div className="mt-4 grid gap-2">
              <PrimaryButton
                type="button"
                tone="secondary"
                onClick={finalizeNow}
                disabled={draw.status === "cancelled" || draw.status === "completed"}
              >
                추첨 상태 확인
              </PrimaryButton>
              <PrimaryButton
                type="button"
                tone="secondary"
                onClick={copyResult}
                disabled={draw.status !== "completed"}
              >
                <Copy size={18} aria-hidden />
                결과 복사
              </PrimaryButton>
              <PrimaryButton
                type="button"
                tone="danger"
                onClick={cancelDraw}
                disabled={draw.status === "completed" || draw.status === "cancelled"}
              >
                <Ban size={18} aria-hidden />
                의뢰 취소
              </PrimaryButton>
            </div>
          </section>
        </aside>
      </div>

      {editOpen ? (
        <form onSubmit={saveEdit} className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">시작 전 의뢰 수정</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="의뢰 제목">
              <TextInput value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} />
            </Field>
            <Field label="참여 시작 시간">
              <TextInput type="datetime-local" value={edit.startAt} onChange={(event) => setEdit({ ...edit, startAt: event.target.value })} />
            </Field>
            <Field label="출발지">
              <TextInput value={edit.origin} onChange={(event) => setEdit({ ...edit, origin: event.target.value })} />
            </Field>
            <Field label="도착지">
              <TextInput value={edit.destination} onChange={(event) => setEdit({ ...edit, destination: event.target.value })} />
            </Field>
            <Field label="출발 예정 시간">
              <TextInput type="datetime-local" value={edit.departureTime} onChange={(event) => setEdit({ ...edit, departureTime: event.target.value })} />
            </Field>
            <Field label="참여 제한 시간(초)">
              <TextInput type="number" min={30} max={3600} step={30} value={edit.durationSeconds} onChange={(event) => setEdit({ ...edit, durationSeconds: Number(event.target.value) })} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="예상 요금">
              <TextInput value={edit.estimatedFare} onChange={(event) => setEdit({ ...edit, estimatedFare: event.target.value })} />
            </Field>
            <Field label="관리자 메모">
              <TextArea value={edit.adminMemo} onChange={(event) => setEdit({ ...edit, adminMemo: event.target.value })} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="고객 요청사항">
              <TextArea value={edit.customerRequest} onChange={(event) => setEdit({ ...edit, customerRequest: event.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <PrimaryButton type="submit" disabled={saving}>
              <Save size={18} aria-hidden />
              {saving ? "저장 중" : "수정 저장"}
            </PrimaryButton>
          </div>
        </form>
      ) : null}

      <section className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Users size={21} className="text-brand-600" aria-hidden />
            전체 참여자 목록
          </h2>
          <span className="text-sm font-black text-slate-500">{draw.participantCount}명</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-slate-200">
          {draw.participants.length === 0 ? (
            <p className="bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
              아직 참여자가 없습니다.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {draw.participants.map((participant, index) => (
                <div
                  key={participant.id}
                  className={`grid grid-cols-[2rem_1fr] gap-3 p-3 sm:grid-cols-[2rem_1fr_8rem_8rem] ${
                    participant.isWinner ? "bg-amber-50" : "bg-white"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-600">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">
                      {participant.name}
                      {participant.isWinner ? (
                        <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
                          당첨
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 sm:hidden">
                      {formatDateTimeKo(participant.joinedAt)} · 차량번호 뒤 4자리 {participant.phoneLast4 ?? "-"}
                    </p>
                  </div>
                  <p className="hidden text-sm font-semibold text-slate-600 sm:block">
                    {formatDateTimeKo(participant.joinedAt)}
                  </p>
                  <p className="hidden text-sm font-black text-slate-700 sm:block">
                    차량번호 {participant.phoneLast4 ?? "-"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-slate-200">
        <h2 className="text-lg font-black text-slate-950">최근 추첨 로그</h2>
        <div className="mt-3 space-y-2">
          {draw.auditLogs.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">로그가 없습니다.</p>
          ) : (
            draw.auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-800">{log.action}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatDateTimeKo(log.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
