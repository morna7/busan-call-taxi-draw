type EnvValueStatus = {
  loaded: boolean;
  length: number;
};

function getEnvValueStatus(value: string | undefined): EnvValueStatus {
  return {
    loaded: Boolean(value),
    length: value?.length ?? 0
  };
}

function getHost(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

export function getServerEnvDiagnostics() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    runtime: "server",
    checkedAt: new Date().toISOString(),
    values: {
      NEXT_PUBLIC_SUPABASE_URL: getEnvValueStatus(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvValueStatus(anonKey),
      SUPABASE_SERVICE_ROLE_KEY: getEnvValueStatus(serviceRoleKey)
    },
    supabaseUrlHost: getHost(supabaseUrl)
  };
}

export function getClientEnvDiagnostics() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    runtime: "client",
    values: {
      NEXT_PUBLIC_SUPABASE_URL: getEnvValueStatus(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvValueStatus(anonKey)
    },
    supabaseUrlHost: getHost(supabaseUrl)
  };
}
