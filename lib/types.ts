export type DrawStatus =
  | "scheduled"
  | "open"
  | "drawing"
  | "completed"
  | "cancelled";

export type DrawRow = {
  id: string;
  public_code: string;
  title: string;
  origin: string;
  destination: string;
  departure_time: string | null;
  estimated_fare: string | null;
  customer_request: string | null;
  admin_memo: string | null;
  status: DrawStatus;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  winner_participant_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  drawn_at: string | null;
  cancelled_at: string | null;
};

export type ParticipantRow = {
  id: string;
  draw_id: string;
  name: string;
  phone_last4: string | null;
  joined_at: string;
  user_agent_hash: string | null;
  is_winner: boolean;
};

export type AuditLogRow = {
  id: string;
  draw_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type PublicDrawState = {
  serverNow: string;
  draw: {
    id: string;
    publicCode: string;
    title: string;
    origin: string;
    destination: string;
    departureTime: string | null;
    estimatedFare: string | null;
    status: DrawStatus;
    startAt: string;
    endAt: string;
    durationSeconds: number;
    winnerParticipantId: string | null;
    winnerName: string | null;
    drawnAt: string | null;
  };
  participantCount: number;
  publicParticipants: Array<{
    id: string;
    name: string;
    isWinner: boolean;
  }>;
  viewerParticipant: {
    id: string;
    name: string;
    phoneLast4: string | null;
    joinedAt: string;
    isWinner: boolean;
  } | null;
};

export type AdminDrawSummary = {
  id: string;
  publicCode: string;
  title: string;
  origin: string;
  destination: string;
  departureTime: string | null;
  status: DrawStatus;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  participantCount: number;
  winnerName: string | null;
  drawnAt: string | null;
  cancelledAt: string | null;
};

export type AdminDrawDetail = AdminDrawSummary & {
  estimatedFare: string | null;
  customerRequest: string | null;
  adminMemo: string | null;
  createdAt: string;
  updatedAt: string;
  winnerParticipantId: string | null;
  participants: Array<{
    id: string;
    name: string;
    phoneLast4: string | null;
    joinedAt: string;
    isWinner: boolean;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    details: Record<string, unknown> | null;
    createdAt: string;
  }>;
};

export const DRAW_STATUS_LABEL: Record<DrawStatus, string> = {
  scheduled: "대기중",
  open: "진행중",
  drawing: "마감중",
  completed: "완료",
  cancelled: "취소"
};

export const DRAW_STATUS_TONE: Record<DrawStatus, string> = {
  scheduled: "bg-slate-100 text-slate-700 ring-slate-200",
  open: "bg-blue-50 text-blue-700 ring-blue-200",
  drawing: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200"
};
