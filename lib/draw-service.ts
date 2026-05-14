import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminDrawDetail,
  AdminDrawSummary,
  AuditLogRow,
  DrawRow,
  ParticipantRow,
  PublicDrawState
} from "@/lib/types";

export async function insertAuditLog(
  client: SupabaseClient,
  drawId: string,
  action: string,
  details: Record<string, unknown> | null = null
) {
  const { error } = await client.from("draw_audit_logs").insert({
    draw_id: drawId,
    action,
    details
  });

  if (error) {
    throw error;
  }
}

export async function openDrawIfNeeded(
  client: SupabaseClient,
  draw: DrawRow,
  now = new Date()
): Promise<DrawRow> {
  if (
    draw.status !== "scheduled" ||
    now.getTime() < new Date(draw.start_at).getTime() ||
    now.getTime() >= new Date(draw.end_at).getTime()
  ) {
    return draw;
  }

  const { data, error } = await client
    .from("draws")
    .update({ status: "open", updated_at: now.toISOString() })
    .eq("id", draw.id)
    .eq("status", "scheduled")
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    await insertAuditLog(client, draw.id, "draw_opened", { reason: "start_time_reached" });
    return data as DrawRow;
  }

  return draw;
}

export async function getParticipantCount(client: SupabaseClient, drawId: string) {
  const { count, error } = await client
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("draw_id", drawId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export function toPublicDrawState(args: {
  draw: DrawRow;
  participantCount: number;
  winner: ParticipantRow | null;
  viewerParticipant: ParticipantRow | null;
  serverNow?: Date;
}): PublicDrawState {
  const { draw, participantCount, winner, viewerParticipant, serverNow = new Date() } = args;

  return {
    serverNow: serverNow.toISOString(),
    draw: {
      id: draw.id,
      publicCode: draw.public_code,
      title: draw.title,
      origin: draw.origin,
      destination: draw.destination,
      departureTime: draw.departure_time,
      estimatedFare: draw.estimated_fare,
      status: draw.status,
      startAt: draw.start_at,
      endAt: draw.end_at,
      durationSeconds: draw.duration_seconds,
      winnerParticipantId: draw.winner_participant_id,
      winnerName: winner?.name ?? null,
      drawnAt: draw.drawn_at
    },
    participantCount,
    viewerParticipant: viewerParticipant
      ? {
          id: viewerParticipant.id,
          name: viewerParticipant.name,
          phoneLast4: viewerParticipant.phone_last4,
          joinedAt: viewerParticipant.joined_at,
          isWinner: viewerParticipant.is_winner
        }
      : null
  };
}

export function toAdminDrawSummary(
  draw: DrawRow,
  participants: ParticipantRow[]
): AdminDrawSummary {
  const winner = participants.find((participant) => participant.id === draw.winner_participant_id);

  return {
    id: draw.id,
    publicCode: draw.public_code,
    title: draw.title,
    origin: draw.origin,
    destination: draw.destination,
    departureTime: draw.departure_time,
    status: draw.status,
    startAt: draw.start_at,
    endAt: draw.end_at,
    durationSeconds: draw.duration_seconds,
    participantCount: participants.length,
    winnerName: winner?.name ?? null,
    drawnAt: draw.drawn_at,
    cancelledAt: draw.cancelled_at
  };
}

export function toAdminDrawDetail(args: {
  draw: DrawRow;
  participants: ParticipantRow[];
  auditLogs: AuditLogRow[];
}): AdminDrawDetail {
  const summary = toAdminDrawSummary(args.draw, args.participants);

  return {
    ...summary,
    estimatedFare: args.draw.estimated_fare,
    customerRequest: args.draw.customer_request,
    adminMemo: args.draw.admin_memo,
    createdAt: args.draw.created_at,
    updatedAt: args.draw.updated_at,
    winnerParticipantId: args.draw.winner_participant_id,
    participants: args.participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      phoneLast4: participant.phone_last4,
      joinedAt: participant.joined_at,
      isWinner: participant.is_winner
    })),
    auditLogs: args.auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      createdAt: log.created_at
    }))
  };
}
