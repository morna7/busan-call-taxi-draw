"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Save } from "lucide-react";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type FormState = {
  title: string;
  origin: string;
  destination: string;
  departureTime: string;
  estimatedFare: string;
  customerRequest: string;
  adminMemo: string;
  durationSeconds: number;
  startMode: "now" | "scheduled";
  startAt: string;
};

export type DrawFormInitialValues = Partial<FormState>;

function getCurrentDateTimeLocalValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

function createInitialState(initialValues?: DrawFormInitialValues): FormState {
  const base: FormState = {
    title: "",
    origin: "",
    destination: "",
    departureTime: "",
    estimatedFare: "",
    customerRequest: "",
    adminMemo: "",
    durationSeconds: 180,
    startMode: "now",
    startAt: getCurrentDateTimeLocalValue()
  };

  return {
    ...base,
    ...initialValues,
    durationSeconds: initialValues?.durationSeconds ?? base.durationSeconds,
    startMode: initialValues?.startMode ?? base.startMode,
    startAt: initialValues?.startAt ?? base.startAt
  };
}

export function DrawForm({
  initialValues,
  submitLabel = "의뢰 등록"
}: {
  initialValues?: DrawFormInitialValues;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => createInitialState(initialValues));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const scheduledStartAt =
        form.startMode === "scheduled" && form.startAt ? new Date(form.startAt) : null;

      if (form.startMode === "scheduled") {
        if (!scheduledStartAt || Number.isNaN(scheduledStartAt.getTime())) {
          throw new Error("참여 시작 시간이 올바르지 않습니다.");
        }
      }

      const requestText = form.title.trim();
      const response = await fetch("/api/admin/draws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: requestText,
          origin: requestText,
          destination: "",
          departureTime: form.departureTime.trim() || null,
          adminMemo: null,
          startAt: scheduledStartAt ? scheduledStartAt.toISOString() : null
        })
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        data?: { id: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message || "의뢰를 등록하지 못했습니다.");
      }

      router.push(`/admin/draws/${payload.data.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "의뢰 등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-blue-100 text-brand-700 ring-1 ring-blue-100">
            <CalendarClock size={21} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-black text-slate-950">의뢰 정보</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              고객 전화번호, 상세 주소, 계좌번호 같은 민감한 개인정보는 입력하지 않는 것을 권장합니다.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="의뢰 내용">
            <TextInput
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="예: 부산역에서 경주 11일 17시"
              required
            />
          </Field>
          <Field label="출발 예정 시간">
            <TextInput
              value={form.departureTime}
              onChange={(event) => update("departureTime", event.target.value)}
              placeholder="선택"
            />
          </Field>
          <Field label="요금" hint="선택 입력입니다. 예: 35만원">
            <TextInput
              value={form.estimatedFare}
              onChange={(event) => update("estimatedFare", event.target.value)}
              placeholder="선택"
            />
          </Field>
          <Field label="고객 요청사항" hint="민감한 개인정보는 제외하고 필요한 업무 내용만 적어 주세요.">
            <TextArea
              value={form.customerRequest}
              onChange={(event) => update("customerRequest", event.target.value)}
              placeholder="선택"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/80 sm:p-6">
        <h2 className="text-lg font-black text-slate-950">참여 시간</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-slate-200/80">
          <button
            type="button"
            onClick={() => update("startMode", "now")}
            className={`rounded-xl px-3 py-3.5 text-sm font-black transition ${
              form.startMode === "now" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            }`}
          >
            즉시 시작
          </button>
          <button
            type="button"
            onClick={() => {
              setForm((current) => ({
                ...current,
                startMode: "scheduled",
                startAt: getCurrentDateTimeLocalValue()
              }));
            }}
            className={`rounded-xl px-3 py-3.5 text-sm font-black transition ${
              form.startMode === "scheduled" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            }`}
          >
            예약 시작
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {form.startMode === "scheduled" ? (
            <Field label="참여 시작 시간">
              <TextInput
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => update("startAt", event.target.value)}
                required={form.startMode === "scheduled"}
              />
            </Field>
          ) : null}
          <Field label="참여 제한 시간" hint="기본값은 3분입니다.">
            <div className="flex items-center gap-2">
              <TextInput
                type="number"
                min={30}
                max={3600}
                step={30}
                value={form.durationSeconds}
                onChange={(event) => update("durationSeconds", Number(event.target.value))}
                required
              />
              <span className="shrink-0 text-sm font-bold text-slate-500">초</span>
            </div>
          </Field>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}

      <div className="safe-bottom sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <PrimaryButton type="submit" className="w-full" disabled={submitting}>
          <Save size={20} aria-hidden />
          {submitting ? "등록 중" : submitLabel}
        </PrimaryButton>
      </div>
    </form>
  );
}
