import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { DrawForm } from "@/components/admin/DrawForm";
import { requireAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewDrawPage() {
  await requireAdminUser();

  return (
    <div className="min-h-dvh">
      <AdminTopBar />
      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:py-7">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-950"
        >
          <ChevronLeft size={17} aria-hidden />
          대시보드
        </Link>
        <h1 className="mt-4 rounded-3xl bg-gradient-to-br from-white via-blue-50 to-slate-100 p-5 text-2xl font-black text-slate-950 shadow-card ring-1 ring-slate-200/80">새 의뢰 등록</h1>
        <p className="mt-3 rounded-2xl bg-white/75 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 shadow-sm ring-1 ring-slate-200/70">
          등록 후 참여 링크와 QR 코드를 기사님들에게 공유할 수 있습니다.
        </p>
        <div className="mt-5">
          <DrawForm />
        </div>
      </main>
    </div>
  );
}
