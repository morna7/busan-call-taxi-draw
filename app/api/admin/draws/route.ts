import { NextRequest, NextResponse } from "next/server";
import { createPublicCode } from "@/lib/public-code";
import { insertAuditLog } from "@/lib/draw-service";
import { HttpError, jsonError } from "@/lib/http";
import { loadAdminDrawSummaries } from "@/lib/admin-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";
import type { DrawRow } from "@/lib/types";
import { validateDrawInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const client = createSupabaseAdminClient();
    const data = await loadAdminDrawSummaries(client);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser();
    const body = await request.json().catch(() => ({}));
    const validation = validateDrawInput(body);

    if (!validation.ok) {
      throw new HttpError(400, validation.code, validation.message);
    }

    const value = validation.value;
    const now = new Date();
    const startAt =
      value.startMode === "now" ? now : new Date(value.startAt as string);
    const endAt = new Date(startAt.getTime() + value.durationSeconds * 1000);

    if (endAt.getTime() <= now.getTime()) {
      throw new HttpError(400, "invalid_start_at", "예약 시간이 이미 마감된 범위입니다.");
    }

    const departureTime = value.departureTime ? new Date(value.departureTime) : null;
    if (departureTime && Number.isNaN(departureTime.getTime())) {
      throw new HttpError(400, "invalid_departure_time", "출발 예정 시간이 올바르지 않습니다.");
    }

    const client = createSupabaseAdminClient();
    let inserted: DrawRow | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      const { data, error } = await client
        .from("draws")
        .insert({
          public_code: createPublicCode(),
          title: value.title,
          origin: value.origin,
          destination: value.destination,
          departure_time: departureTime?.toISOString() ?? null,
          estimated_fare: value.estimatedFare,
          customer_request: value.customerRequest,
          admin_memo: value.adminMemo,
          status: now.getTime() >= startAt.getTime() ? "open" : "scheduled",
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          duration_seconds: value.durationSeconds,
          created_by: user.id
        })
        .select("*")
        .single();

      if (error) {
        lastError = error;
        if (error.code !== "23505") {
          throw error;
        }
      } else {
        inserted = data as DrawRow;
      }
    }

    if (!inserted) {
      throw lastError ?? new Error("의뢰를 등록하지 못했습니다.");
    }

    await insertAuditLog(client, inserted.id, "draw_created", {
      createdBy: user.id,
      startMode: value.startMode
    });

    return NextResponse.json({ ok: true, data: inserted }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
