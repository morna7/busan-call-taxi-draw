import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  return NextResponse.json(
    { ok: false, code: "internal_error", message },
    { status: 500 }
  );
}
