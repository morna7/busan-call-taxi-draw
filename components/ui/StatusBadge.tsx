import { DRAW_STATUS_LABEL, DRAW_STATUS_TONE, type DrawStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: DrawStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black shadow-sm ring-1 ${DRAW_STATUS_TONE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {DRAW_STATUS_LABEL[status]}
    </span>
  );
}
