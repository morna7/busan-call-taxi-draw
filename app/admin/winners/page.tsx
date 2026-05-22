import Link from "next/link";
import { ChevronLeft, Medal, Trophy } from "lucide-react";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { loadWinnerRankings } from "@/lib/admin-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";
import { formatDateTimeKo } from "@/lib/time";

export const dynamic = "force-dynamic";

function rankTone(rank: number) {
  if (rank === 1) {
    return "from-amber-300 via-yellow-100 to-white text-amber-950 ring-amber-200";
  }

  if (rank === 2) {
    return "from-slate-200 via-white to-white text-slate-900 ring-slate-200";
  }

  if (rank === 3) {
    return "from-orange-200 via-amber-50 to-white text-orange-950 ring-orange-200";
  }

  return "from-white via-slate-50 to-white text-slate-900 ring-slate-200";
}

export default async function WinnerHallOfFamePage() {
  await requireAdminUser();
  const data = await loadWinnerRankings(createSupabaseAdminClient());
  const topWinner = data.rankings[0];

  return (
    <div className="min-h-dvh bg-slate-50">
      <AdminTopBar />
      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:py-7">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-950"
        >
          <ChevronLeft size={17} aria-hidden />
          대시보드
        </Link>

        <section className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-brand-900 to-brand-700 p-5 text-white shadow-lift ring-1 ring-blue-200/40 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-blue-200">추첨 히스토리</p>
              <h1 className="mt-1 text-3xl font-black tracking-normal">장거리 당첨왕</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-100">
                닉네임과 차량번호 뒤 4자리 조합 기준으로 당첨 횟수를 집계합니다.
              </p>
            </div>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <Trophy size={28} aria-hidden />
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
              <p className="text-xs font-black text-blue-100">전체 당첨 기록</p>
              <p className="mt-1 text-2xl font-black">{data.totalWins}회</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 sm:col-span-2">
              <p className="text-xs font-black text-blue-100">현재 1위</p>
              <p className="mt-1 text-2xl font-black">
                {topWinner ? `${topWinner.name} - ${topWinner.winCount}회 당첨` : "아직 당첨 기록 없음"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-950">순위</h2>
            <p className="text-sm font-bold text-slate-500">서버 기준: {formatDateTimeKo(data.serverNow)}</p>
          </div>

          {data.rankings.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <Trophy className="mx-auto text-slate-300" size={34} aria-hidden />
              <p className="mt-3 text-base font-black text-slate-700">아직 당첨 기록이 없습니다.</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                추첨 완료 후 당첨자가 생기면 이곳에 순위가 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {data.rankings.map((winner) => (
                <article
                  key={`${winner.name}-${winner.phoneLast4 ?? "none"}`}
                  className={`rounded-3xl bg-gradient-to-br p-4 shadow-sm ring-1 ${rankTone(winner.rank)}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-lg font-black shadow-sm ring-1 ring-white">
                      {winner.rank <= 3 ? <Medal size={24} aria-hidden /> : winner.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xl font-black">{winner.rank}위 {winner.name}</p>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-black ring-1 ring-white/80">
                          {winner.phoneLast4 ? `차량 ${winner.phoneLast4}` : "차량번호 미입력"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold opacity-75">
                        최근 당첨: {formatDateTimeKo(winner.latestWonAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-3xl font-black">{winner.winCount}</p>
                      <p className="text-xs font-black opacity-70">회 당첨</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
