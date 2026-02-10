/**
 * Structured error response and helpers for API routes.
 * Use for consistent { error: { code, message, requestId? } } JSON.
 */

/** True when Prisma/DB error indicates schema not migrated (e.g. relation/table missing). */
export function isDbSchemaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const msg = String((e as Error).message ?? "");
  const code = (e as { code?: string }).code;
  return (
    msg.includes("does not exist") ||
    code === "P2010"
  );
}

export function errorBody(
  code: string,
  message: string,
  requestId?: string,
): { error: { code: string; message: string; requestId?: string } } {
  const body: { error: { code: string; message: string; requestId?: string } } = {
    error: { code, message },
  };
  if (requestId != null) body.error.requestId = requestId;
  return body;
}
