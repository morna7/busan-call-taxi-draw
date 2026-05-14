"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { getClientEnvDiagnostics } from "@/lib/env-diagnostics";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Field, TextInput } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type EnvValueStatus = {
  loaded: boolean;
  length: number;
};

type EnvDiagnostics = {
  runtime: string;
  checkedAt?: string;
  values: {
    NEXT_PUBLIC_SUPABASE_URL: EnvValueStatus;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: EnvValueStatus;
    SUPABASE_SERVICE_ROLE_KEY?: EnvValueStatus;
  };
  supabaseUrlHost: string | null;
};

type ServerEnvDiagnosticsResponse = {
  ok: boolean;
  data?: EnvDiagnostics;
  message?: string;
};

type AuthDiagnostics = {
  serverSeesUser: boolean;
  userEmail: string | null;
  userId: string | null;
  authCookieCount: number;
  authCookieNames: string[];
  errorMessage: string | null;
};

type AuthDiagnosticsResponse = {
  ok: boolean;
  data?: AuthDiagnostics;
  message?: string;
};

function StatusPill({ loaded }: { loaded: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
        loaded ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {loaded ? "로드됨" : "누락"}
    </span>
  );
}

function EnvDiagnosticsPanel({
  clientEnv,
  serverEnv,
  serverEnvError
}: {
  clientEnv: EnvDiagnostics;
  serverEnv: EnvDiagnostics | null;
  serverEnvError: string | null;
}) {
  const rows = [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      client: clientEnv.values.NEXT_PUBLIC_SUPABASE_URL.loaded,
      server: serverEnv?.values.NEXT_PUBLIC_SUPABASE_URL.loaded ?? null
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      client: clientEnv.values.NEXT_PUBLIC_SUPABASE_ANON_KEY.loaded,
      server: serverEnv?.values.NEXT_PUBLIC_SUPABASE_ANON_KEY.loaded ?? null
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      client: null,
      server: serverEnv?.values.SUPABASE_SERVICE_ROLE_KEY?.loaded ?? null
    }
  ];

  return (
    <section className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-800">배포 환경변수 확인</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            키 값은 표시하지 않고, Vercel에서 로드 여부만 확인합니다.
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.name} className="rounded-md bg-white p-2 ring-1 ring-slate-100">
            <p className="break-all text-xs font-black text-slate-700">{row.name}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {row.client === null ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500">
                  브라우저 비공개
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  브라우저 <StatusPill loaded={row.client} />
                </span>
              )}
              {row.server === null ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500">
                  서버 확인 중
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  서버 <StatusPill loaded={row.server} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 break-all text-xs leading-5 text-slate-500">
        Supabase URL host: {serverEnv?.supabaseUrlHost ?? clientEnv.supabaseUrlHost ?? "확인 안 됨"}
      </p>
      {serverEnvError ? (
        <p className="mt-2 text-xs font-bold leading-5 text-rose-700">{serverEnvError}</p>
      ) : null}
    </section>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [clientEnv] = useState<EnvDiagnostics>(() => getClientEnvDiagnostics());
  const [serverEnv, setServerEnv] = useState<EnvDiagnostics | null>(null);
  const [serverEnvError, setServerEnvError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch("/api/diagnostics/env", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as ServerEnvDiagnosticsResponse;
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.message || "서버 환경변수 상태를 불러오지 못했습니다.");
        }
        if (mounted) {
          setServerEnv(payload.data);
        }
      })
      .catch((caught) => {
        if (mounted) {
          setServerEnvError(
            caught instanceof Error ? caught.message : "서버 환경변수 상태를 불러오지 못했습니다."
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDebugMessage(null);
    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(`Supabase 로그인 오류: ${signInError.message}`);
        return;
      }

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(`Supabase 세션 확인 오류: ${sessionError.message}`);
        return;
      }

      const browserCookieNames = document.cookie
        .split(";")
        .map((cookie) => cookie.trim().split("=")[0])
        .filter((name) => name.startsWith("sb-"));

      const authResponse = await fetch("/api/diagnostics/auth", {
        cache: "no-store",
        credentials: "include"
      });
      const authPayload = (await authResponse.json()) as AuthDiagnosticsResponse;

      if (!authResponse.ok || !authPayload.ok || !authPayload.data) {
        setError(authPayload.message || "로그인 후 서버 세션 확인에 실패했습니다.");
        return;
      }

      const debugLines = [
        `로그인 성공: ${signInData.user?.email ?? email}`,
        `브라우저 세션 저장: ${session ? "성공" : "실패"}`,
        `브라우저 Supabase 쿠키 수: ${browserCookieNames.length}`,
        `서버 Supabase 쿠키 수: ${authPayload.data.authCookieCount}`,
        `서버 사용자 인식: ${authPayload.data.serverSeesUser ? "성공" : "실패"}`,
        authPayload.data.errorMessage ? `서버 인증 오류: ${authPayload.data.errorMessage}` : null
      ].filter(Boolean);
      setDebugMessage(debugLines.join(" / "));

      if (!session) {
        setError("로그인은 성공했지만 브라우저에 Supabase session이 저장되지 않았습니다.");
        return;
      }

      if (!authPayload.data.serverSeesUser) {
        setError(
          authPayload.data.errorMessage
            ? `로그인은 성공했지만 서버가 session cookie를 읽지 못합니다: ${authPayload.data.errorMessage}`
            : "로그인은 성공했지만 서버가 session cookie를 읽지 못합니다."
        );
        return;
      }

      const next = searchParams.get("next") || "/admin";
      window.location.assign(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="관리자 이메일">
        <TextInput
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@example.com"
          required
        />
      </Field>
      <Field label="비밀번호">
        <TextInput
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호"
          required
        />
      </Field>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      {debugMessage ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-800">
          {debugMessage}
        </p>
      ) : null}
      <EnvDiagnosticsPanel
        clientEnv={clientEnv}
        serverEnv={serverEnv}
        serverEnvError={serverEnvError}
      />
      <PrimaryButton type="submit" className="w-full" disabled={loading}>
        <LogIn size={20} aria-hidden />
        {loading ? "로그인 중" : "관리자 로그인"}
      </PrimaryButton>
    </form>
  );
}
