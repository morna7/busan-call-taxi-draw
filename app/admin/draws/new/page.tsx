import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { DrawForm, type DrawFormInitialValues } from "@/components/admin/DrawForm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";
import type { DrawRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type NewDrawPageProps = {
  searchParams?: Promise<{
    copyFrom?: string;
  }>;
};

async function loadCopySource(copyFrom?: string): Promise<DrawFormInitialValues | null> {
  if (!copyFrom) {
    return null;
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("draws")
    .select("*")
    .eq("id", copyFrom)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const draw = data as DrawRow;
  return {
    title: draw.title,
    origin: draw.origin,
    destination: draw.destination,
    departureTime: draw.departure_time ?? "",
    estimatedFare: draw.estimated_fare ?? "",
    customerRequest: draw.customer_request ?? "",
    adminMemo: draw.admin_memo ?? "",
    durationSeconds: draw.duration_seconds,
    startMode: "now"
  };
}

export default async function NewDrawPage({ searchParams }: NewDrawPageProps) {
  await requireAdminUser();
  const params = await searchParams;
  const copiedValues = await loadCopySource(params?.copyFrom);
  const isCopyMode = Boolean(copiedValues);

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
        <h1 className="mt-4 rounded-3xl bg-gradient-to-br from-white via-blue-50 to-slate-100 p-5 text-2xl font-black text-slate-950 shadow-card ring-1 ring-slate-200/80">
          {isCopyMode ? "의뢰 재등록" : "새 의뢰 등록"}
        </h1>
        <p className="mt-3 rounded-2xl bg-white/75 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 shadow-sm ring-1 ring-slate-200/70">
          {isCopyMode
            ? "기존 의뢰 정보를 복사했습니다. 필요한 부분을 수정한 뒤 새 의뢰로 등록하세요."
            : "등록 후 참여 링크와 QR 코드를 기사님들에게 공유할 수 있습니다."}
        </p>
        <div className="mt-5">
          <DrawForm
            initialValues={copiedValues ?? undefined}
            submitLabel={isCopyMode ? "재등록하기" : "의뢰 등록"}
          />
        </div>
      </main>
    </div>
  );
}
