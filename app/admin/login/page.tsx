import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200/80">
        <p className="text-sm font-bold text-brand-600">관리자 로그인</p>
        <h1 className="mt-2 text-2xl font-black leading-tight text-slate-950">
          장거리전문부산콜택시 배차 추첨
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Supabase Auth에 등록된 관리자 계정으로 로그인해 주세요.
        </p>
        <div className="mt-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
