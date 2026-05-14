export type ParticipantInput = {
  name: string;
  phoneLast4?: string | null;
};

export type DrawInput = {
  title: string;
  origin: string;
  destination: string;
  departureTime?: string | null;
  estimatedFare?: string | null;
  customerRequest?: string | null;
  adminMemo?: string | null;
  durationSeconds?: number;
  startMode?: "now" | "scheduled";
  startAt?: string | null;
};

export function normalizeName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeOptionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function normalizePhoneLast4(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function validateParticipantInput(input: ParticipantInput): {
  ok: true;
  value: Required<ParticipantInput> & { phoneLast4: string | null };
} | {
  ok: false;
  message: string;
  code: string;
} {
  const name = normalizeName(input.name);
  const phoneLast4 = normalizePhoneLast4(input.phoneLast4);

  if (!name) {
    return { ok: false, message: "닉네임을 입력해 주세요.", code: "name_required" };
  }

  if (phoneLast4 && !/^\d{4}$/.test(phoneLast4)) {
    return {
      ok: false,
      message: "차량번호 뒤 4자리는 숫자 4자리로 입력해 주세요.",
      code: "invalid_phone_last4"
    };
  }

  return { ok: true, value: { name, phoneLast4 } };
}

export function validateDrawInput(input: DrawInput): {
  ok: true;
  value: Required<Omit<DrawInput, "departureTime" | "estimatedFare" | "customerRequest" | "adminMemo" | "startAt">> & {
    departureTime: string | null;
    estimatedFare: string | null;
    customerRequest: string | null;
    adminMemo: string | null;
    startAt: string | null;
  };
} | {
  ok: false;
  message: string;
  code: string;
} {
  const title = normalizeOptionalText(input.title);
  const origin = normalizeOptionalText(input.origin);
  const destination = normalizeOptionalText(input.destination);
  const durationSeconds = Number(input.durationSeconds ?? 180);
  const startMode = input.startMode ?? "now";
  const startAt = normalizeOptionalText(input.startAt);

  if (!title) {
    return { ok: false, message: "의뢰 제목을 입력해 주세요.", code: "title_required" };
  }

  if (!origin) {
    return { ok: false, message: "출발지를 입력해 주세요.", code: "origin_required" };
  }

  if (!destination) {
    return { ok: false, message: "도착지를 입력해 주세요.", code: "destination_required" };
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds < 30 || durationSeconds > 3600) {
    return {
      ok: false,
      message: "참여 제한 시간은 30초 이상 3600초 이하로 입력해 주세요.",
      code: "invalid_duration"
    };
  }

  if (startMode === "scheduled" && !startAt) {
    return {
      ok: false,
      message: "예약 시작 시간을 입력해 주세요.",
      code: "start_at_required"
    };
  }

  if (startAt && Number.isNaN(new Date(startAt).getTime())) {
    return {
      ok: false,
      message: "예약 시작 시간이 올바르지 않습니다.",
      code: "invalid_start_at"
    };
  }

  return {
    ok: true,
    value: {
      title,
      origin,
      destination,
      departureTime: normalizeOptionalText(input.departureTime),
      estimatedFare: normalizeOptionalText(input.estimatedFare),
      customerRequest: normalizeOptionalText(input.customerRequest),
      adminMemo: normalizeOptionalText(input.adminMemo),
      durationSeconds,
      startMode,
      startAt
    }
  };
}
