import type { SupabaseClient } from "@supabase/supabase-js";
import { openDrawIfNeeded, toAdminDrawDetail, toAdminDrawSummary } from "@/lib/draw-service";
import type { AdminDrawDetail, AdminDrawSummary, AuditLogRow, DrawRow, ParticipantRow } from "@/lib/types";

export async function loadAdminDrawSummaries(client: SupabaseClient): Promise<{
  serverNow: string;
  draws: AdminDrawSummary[];
}> {
  const now = new Date();
  const { data, error } = await client
    .from("draws")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const draws = await Promise.all(
    ((data as DrawRow[]) ?? []).map((draw) => openDrawIfNeeded(client, draw, now))
  );
  const ids = draws.map((draw) => draw.id);
  const { data: participantsData, error: participantsError } = ids.length
    ? await client
        .from("participants")
        .select("*")
        .in("draw_id", ids)
        .order("joined_at", { ascending: true })
    : { data: [], error: null };

  if (participantsError) {
    throw participantsError;
  }

  const participants = ((participantsData as ParticipantRow[]) ?? []).reduce<
    Record<string, ParticipantRow[]>
  >((acc, participant) => {
    acc[participant.draw_id] = acc[participant.draw_id] ?? [];
    acc[participant.draw_id].push(participant);
    return acc;
  }, {});

  return {
    serverNow: now.toISOString(),
    draws: draws.map((draw) => toAdminDrawSummary(draw, participants[draw.id] ?? []))
  };
}

export async function loadAdminDrawDetail(
  client: SupabaseClient,
  drawId: string
): Promise<{ serverNow: string; draw: AdminDrawDetail | null }> {
  const now = new Date();
  const { data: rawDraw, error: drawError } = await client
    .from("draws")
    .select("*")
    .eq("id", drawId)
    .maybeSingle();

  if (drawError) {
    throw drawError;
  }

  if (!rawDraw) {
    return { serverNow: now.toISOString(), draw: null };
  }

  const draw = await openDrawIfNeeded(client, rawDraw as DrawRow, now);
  const [participantsResult, auditResult] = await Promise.all([
    client
      .from("participants")
      .select("*")
      .eq("draw_id", draw.id)
      .order("joined_at", { ascending: true }),
    client
      .from("draw_audit_logs")
      .select("*")
      .eq("draw_id", draw.id)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  if (participantsResult.error) {
    throw participantsResult.error;
  }

  if (auditResult.error) {
    throw auditResult.error;
  }

  return {
    serverNow: now.toISOString(),
    draw: toAdminDrawDetail({
      draw,
      participants: (participantsResult.data as ParticipantRow[]) ?? [],
      auditLogs: (auditResult.data as AuditLogRow[]) ?? []
    })
  };
}
