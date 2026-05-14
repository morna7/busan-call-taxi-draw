import { createHash } from "node:crypto";

export function hashUserAgent(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
