import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { loadAdminDrawSummaries } from "@/lib/admin-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdminUser();
  const data = await loadAdminDrawSummaries(createSupabaseAdminClient());

  return (
    <div className="min-h-dvh bg-slate-50">
      <AdminTopBar />
      <AdminDashboard initialData={data} />
    </div>
  );
}
