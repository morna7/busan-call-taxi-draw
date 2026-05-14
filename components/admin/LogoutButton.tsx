"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
      aria-label="로그아웃"
      title="로그아웃"
    >
      <LogOut size={19} aria-hidden />
    </button>
  );
}
