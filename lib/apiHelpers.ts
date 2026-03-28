import { type NextRequest, NextResponse } from "next/server";
import type { z } from "zod";

/** Extract a human-readable message from an unknown caught value. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

/** Return a JSON error response, mapping "not found" messages to 404. */
export function errorResponse(err: unknown, { notFoundAs404 = false } = {}): NextResponse {
  const message = errorMessage(err);
  const status = notFoundAs404 && message.includes("not found") ? 404 : 500;
  return NextResponse.json({ error: message }, { status });
}

/** Format Zod validation errors into a single comma-separated string. */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(", ");
}

/**
 * Check the `X-Expected-UpdatedAt` header against the current entity version.
 * Returns a 409 response if there is a conflict, or `null` if no conflict / no header.
 */
export async function checkConflict<T extends { updatedAt: string }>(
  request: NextRequest,
  getCurrent: () => Promise<T | null>,
): Promise<NextResponse | null> {
  const expectedUpdatedAt = request.headers.get("X-Expected-UpdatedAt");
  if (expectedUpdatedAt === null) {
    return null;
  }

  const current = await getCurrent();
  if (current !== null && current.updatedAt !== expectedUpdatedAt) {
    return NextResponse.json(
      { error: "conflict", serverVersion: current },
      { status: 409 },
    );
  }

  return null;
}

/**
 * Idempotent delete: if the underlying delete throws "not found", treat it as success.
 */
export async function idempotentDelete(deleteFn: () => Promise<void>): Promise<NextResponse> {
  try {
    await deleteFn();
  } catch (err) {
    const message = errorMessage(err);
    if (message.includes("not found")) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
