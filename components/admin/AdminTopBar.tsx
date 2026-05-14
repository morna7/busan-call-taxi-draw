import Link from "next/link";
import { CarTaxiFront, Plus } from "lucide-react";
import { LogoutButton } from "@/components/admin/LogoutButton";

export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <CarTaxiFront size={22} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-950">
              배차 추첨
            </span>
            <span className="block truncate text-xs font-semibold text-slate-500">
              장거리전문부산콜택시
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/draws/new"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm transition hover:bg-brand-700"
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
