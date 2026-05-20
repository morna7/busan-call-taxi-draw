"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Plus, RefreshCw, RotateCcw, Trash2, Users } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { formatCountdown, formatDateTimeKo, formatPlainText } from "@/lib/time";
import type { AdminDrawSummary, DrawStatus } from "@/lib/types";
import { DRAW_STATUS_LABEL } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type DashboardData = {
  serverNow: string;
  draws: AdminDrawSummary[];
};

const STATUS_ORDER: DrawStatus[] = ["open", "scheduled", "completed", "cancelled"];

function remainingText(draw: AdminDrawSummary, serverOffset: number, clientNow: number) {
  if (draw.status === "completed" || draw.status === "cancelled") {
    return "-";
  }

  const remaining = Math.max(
    0,
    Math.ceil((new Date(draw.endAt).getTime() - (clientNow + serverOffset)) / 1000)
  );
  return formatCountdown(remaining);
}

export function AdminDashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [clientNow, setClientNow] = useState(() => new Date(initialData.serverNow).getTime());
  const [serverOffset, setServerOffset] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const finalizing = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/draws", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data?: DashboardData; message?: string };
    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.message || "대시보드를 새로고침하지 못했습니다.");
    }
    setServerOffset(new Date(payload.data.serverNow).getTime() - Date.now());
    setData(payload.data);
  }, []);

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
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "draws" }, () => {
        refresh().catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => {
        refresh().catch(() => undefined);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    const approxNow = clientNow + serverOffset;

    data.draws
      .filter((draw) => {
        return (
          (draw.status === "open" || draw.status === "scheduled") &&
          new Date(draw.endAt).getTime() <= approxNow &&
          !finalizing.current.has(draw.id)
        );
      })
      .forEach((draw) => {
        finalizing.current.add(draw.id);
        fetch(`/api/admin/draws/${draw.id}/finalize`, { method: "POST" })
          .then(() => refresh())
          .catch(() => undefined)
          .finally(() => {
            finalizing.current.delete(draw.id);
          });
      });
  }, [clientNow, data.draws, refresh, serverOffset]);

  const grouped = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status,
      draws: data.draws.filter((draw) => draw.status === status)
    }));
  }, [data.draws]);

  async function copyJoinLink(draw: AdminDrawSummary) {
    const origin = window.location.origin;
    await navigator.clipboard.writeText(`${origin}/join/${draw.publicCode}`);
    setMessage("참여 링크를 복사했습니다.");
    window.setTimeout(() => setMessage(null), 1800);
  }

  async function deleteDraw(draw: AdminDrawSummary) {
    const confirmed = window.confirm(
      `"${draw.title}" 의뢰를 삭제할까요?\n\n삭제하면 참여자와 추첨 결과도 함께 삭제되며 되돌릴 수 없습니다.`
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/draws/${draw.id}`, {
      method: "DELETE"
    });
    const payload = (await response.json()) as { ok: boolean; message?: string };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message || "의뢰를 삭제하지 못했습니다.");
      window.setTimeout(() => setMessage(null), 2400);
      return;
    }

    setMessage("의뢰를 삭제했습니다.");
    await refresh();
    window.setTimeout(() => setMessage(null), 1800);
  }

  async function rerunDraw(draw: AdminDrawSummary) {
    const confirmed = window.confirm(
      `"${draw.title}" 의뢰를 같은 정보로 다시 투표 시작할까요?\n\n기존 완료 기록은 그대로 남고, 새 참여 링크가 만들어집니다.`
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/draws/${draw.id}/rerun`, {
      method: "POST"
    });
    const payload = (await response.json()) as {
      ok: boolean;
      data?: { id: string };
      message?: string;
    };

    if (!response.ok || !payload.ok || !payload.data) {
      setMessage(payload.message || "재투표를 시작하지 못했습니다.");
      window.setTimeout(() => setMessage(null), 2400);
      return;
    }

    setMessage("동일한 의뢰로 재투표를 시작했습니다.");
    await refresh();
    window.setTimeout(() => setMessage(null), 1800);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:py-7">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-white via-blue-50 to-slate-100 p-5 shadow-card ring-1 ring-slate-200/80 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-black text-brand-600">관리자 대시보드</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">의뢰와 추첨 현황</h1>
          <p className="mt-1 text-sm text-slate-500">서버 기준: {formatDateTimeKo(data.serverNow)}</p>
        </div>
        <div className="flex gap-2">
          <PrimaryButton type="button" tone="secondary" onClick={() => refresh()} className="px-3">
            <RefreshCw size={18} aria-hidden />
            새로고침
          </PrimaryButton>
          <Link
            href="/admin/draws/new"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-600 to-brand-700 px-4 py-3 text-base font-black text-white shadow-lift transition hover:from-brand-500 hover:to-brand-700"
          >
            <Plus size={18} aria-hidden />
            새 의뢰
          </Link>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100">
          {message}
        </p>
      ) : null}

      <div className="mt-6 space-y-7">
        {grouped.map(({ status, draws }) => (
          <section key={status}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-950">{DRAW_STATUS_LABEL[status]}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-500 shadow-sm ring-1 ring-slate-200">{draws.length}건</span>
            </div>
            {draws.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/75 px-4 py-8 text-center text-sm font-bold text-slate-500 shadow-sm">
                해당 상태의 의뢰가 없습니다.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {draws.map((draw) => (
                  <article
                    key={draw.id}
                    className="rounded-3xl bg-white p-4 shadow-card ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/admin/draws/${draw.id}`} className="min-w-0">
                        <h3 className="line-clamp-2 text-lg font-black leading-snug text-slate-950">
                          {draw.title}
                        </h3>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-600">
                          {draw.origin} → {draw.destination}
                        </p>
                      </Link>
                      <StatusBadge status={draw.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-slate-50 px-2 py-3 ring-1 ring-slate-100">
                        <p className="text-xs font-bold text-slate-500">참여자</p>
                        <p className="mt-1 text-xl font-black text-slate-950">{draw.participantCount}</p>
                      </div>
                      <div className="rounded-2xl bg-blue-50 px-2 py-3 ring-1 ring-blue-100">
                        <p className="text-xs font-bold text-blue-700">남은 시간</p>
                        <p className="mt-1 text-xl font-black text-blue-700">
                          {remainingText(draw, serverOffset, clientNow)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-2 py-3 ring-1 ring-slate-100">
                        <p className="text-xs font-bold text-slate-500">당첨자</p>
                        <p className="mt-1 truncate text-base font-black text-slate-950">
                          {draw.winnerName ?? "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-500">
                      <span>출발: {formatPlainText(draw.departureTime)}</span>
                      <span className="inline-flex items-center gap-1 font-bold">
                        <Users size={15} aria-hidden />
                        {draw.participantCount}명
                      </span>
                    </div>

                    {draw.status === "completed" && draw.participantCount === 0 && !draw.winnerName ? (
                      <button
                        type="button"
                        onClick={() => rerunDraw(draw)}
                        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 text-sm font-black text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
                      >
                        <RotateCcw size={16} aria-hidden />
                        재투표 실시
                      </button>
                    ) : null}
                    <Link
                      href={`/admin/draws/new?copyFrom=${encodeURIComponent(draw.id)}`}
                      className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 text-sm font-black text-brand-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                    >
                      <Copy size={16} aria-hidden />
                      재등록
                    </Link>

                    <div className="mt-4 grid grid-cols-[1fr_1fr_2.9rem] gap-2">
                      <button
                        type="button"
                        onClick={() => copyJoinLink(draw)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                      >
                        <Copy size={16} aria-hidden />
                        링크
                      </button>
                      <Link
                        href={`/admin/draws/${draw.id}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800"
                      >
                        <ExternalLink size={16} aria-hidden />
                        상세
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteDraw(draw)}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
                        aria-label="의뢰 삭제"
                        title="의뢰 삭제"
                      >
                        <Trash2 size={17} aria-hidden />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
