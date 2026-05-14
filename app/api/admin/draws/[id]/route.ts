import { NextRequest, NextResponse } from "next/server";
import { loadAdminDrawDetail } from "@/lib/admin-service";
import { insertAuditLog } from "@/lib/draw-service";
import { HttpError, jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";
import type { DrawRow } from "@/lib/types";
import { validateDrawInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser();
    const { id } = await context.params;
    const client = createSupabaseAdminClient();
    const data = await loadAdminDrawDetail(client, id);

    if (!data.draw) {
      throw new HttpError(404, "draw_not_found", "존재하지 않는 의뢰입니다.");
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const client = createSupabaseAdminClient();
    const { data: rawDraw, error: drawError } = await client
      .from("draws")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (drawError) {
      throw drawError;
    }

    if (!rawDraw) {
      throw new HttpError(404, "draw_not_found", "존재하지 않는 의뢰입니다.");
    }

    const draw = rawDraw as DrawRow;
    const now = new Date();

    if (draw.status === "completed" || draw.status === "cancelled" || draw.status === "drawing") {
      throw new HttpError(409, "edit_not_allowed", "완료, 취소, 마감중 의뢰는 수정할 수 없습니다.");
    }

    if (draw.status === "open" || now.getTime() >= new Date(draw.start_at).getTime()) {
      const { data, error } = await client
        .from("draws")
        .update({
          admin_memo: typeof body.adminMemo === "string" ? body.adminMemo.trim() || null : draw.admin_memo,
          updated_at: now.toISOString()
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await insertAuditLog(client, id, "draw_memo_updated", { updatedBy: user.id });
      return NextResponse.json({ ok: true, data });
    }

    const validation = validateDrawInput({
      ...body,
      startMode: "scheduled"
    });

    if (!validation.ok) {
      throw new HttpError(400, validation.code, validation.message);
    }

    const value = validation.value;
    const startAt = new Date(value.startAt as string);
    const endAt = new Date(startAt.getTime() + value.durationSeconds * 1000);
    const departureTime = value.departureTime ? new Date(value.departureTime) : null;

    if (endAt.getTime() <= now.getTime()) {
      throw new HttpError(400, "invalid_start_at", "예약 시간이 이미 마감된 범위입니다.");
    }

    if (departureTime && Number.isNaN(departureTime.getTime())) {
      throw new HttpError(400, "invalid_departure_time", "출발 예정 시간이 올바르지 않습니다.");
    }

    const { data, error } = await client
      .from("draws")
      .update({
        title: value.title,
        origin: value.origin,
        destination: value.destination,
        departure_time: departureTime?.toISOString() ?? null,
        estimated_fare: value.estimatedFare,
        customer_request: value.customerRequest,
        admin_memo: value.adminMemo,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        duration_seconds: value.durationSeconds,
        status: now.getTime() >= startAt.getTime() ? "open" : "scheduled",
        updated_at: now.toISOString()
      })
      .eq("id", id)
      .eq("status", "scheduled")
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await insertAuditLog(client, id, "draw_updated", { updatedBy: user.id });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return jsonError(error);
  }
}
