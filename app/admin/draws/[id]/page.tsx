import { notFound } from "next/navigation";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { DrawDetailClient } from "@/components/admin/DrawDetailClient";
import { loadAdminDrawDetail } from "@/lib/admin-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DrawDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const data = await loadAdminDrawDetail(createSupabaseAdminClient(), id);

  if (!data.draw) {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AdminTopBar />
      <DrawDetailClient initialData={{ serverNow: data.serverNow, draw: data.draw }} />
    </div>
  );
}
