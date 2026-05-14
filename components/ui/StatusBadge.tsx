import { DRAW_STATUS_LABEL, DRAW_STATUS_TONE, type DrawStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: DrawStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${DRAW_STATUS_TONE[status]}`}
    >
      {DRAW_STATUS_LABEL[status]}
    </span>
  );
}
