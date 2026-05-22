import Link from "next/link";
import { CarTaxiFront, Plus, Trophy } from "lucide-react";
import { LogoutButton } from "@/components/admin/LogoutButton";

export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5">
        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lift">
            <CarTaxiFront size={22} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-black text-slate-950">
              배차 추첨
            </span>
            <span className="block truncate text-xs font-bold text-brand-700">
              장거리전문부산콜택시
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/winners"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-50 px-3 text-sm font-black text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
            aria-label="명예의 전당"
            title="명예의 전당"
          >
            <Trophy size={18} aria-hidden />
            <span className="hidden sm:inline">명예의 전당</span>
          </Link>
          <Link
            href="/admin/draws/new"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-lift transition hover:from-brand-500 hover:to-brand-700"
            aria-label="새 의뢰 등록"
            title="새 의뢰 등록"
          >
            <Plus size={20} aria-hidden />
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
