import { type NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import type { SyncEntityType } from './types';
import { SYNC_ENTITY } from './constants';
import { NotFoundError } from './fsHelpers';
import { UnauthorizedError } from './auth';

/**
 * Narrows the `[type]` path param of the trash routes. A type guard rather than
 * a response-returning helper: all three routes branch on `type` afterwards and
 * need it narrowed, so a third entity type could not be forgotten silently.
 */
export function isTrashItemType(value: string): value is SyncEntityType {
  return value === SYNC_ENTITY.NOTE || value === SYNC_ENTITY.TODO;
}

/** The one 400 for an unknown `[type]`, shared by all three trash routes. */
export function invalidTrashTypeResponse(): NextResponse {
  return NextResponse.json({ error: 'Invalid trash item type' }, { status: 400 });
}

/** Extract a human-readable message from an unknown caught value. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

/** Return a JSON error response. NotFoundError → 404, UnauthorizedError → 401. */
export function errorResponse(err: unknown): NextResponse {
  const message = errorMessage(err);
  let status = 500;
  if (err instanceof NotFoundError) {
    status = 404;
  } else if (err instanceof UnauthorizedError) {
    status = 401;
  }

  return NextResponse.json({ error: message }, { status });
}

/** Format Zod validation errors into a single comma-separated string. */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(', ');
}

/**
 * Check the `X-Expected-UpdatedAt` header against the current entity version.
 * Returns a 409 response if there is a conflict, or `null` if no conflict / no header.
 */
export async function checkConflict<T extends { updatedAt: string }>(
  request: NextRequest,
  getCurrent: () => Promise<T | null>,
): Promise<NextResponse | null> {
  const expectedUpdatedAt = request.headers.get('X-Expected-UpdatedAt');
  if (expectedUpdatedAt === null) {
    return null;
  }

  const current = await getCurrent();
  if (current !== null && current.updatedAt !== expectedUpdatedAt) {
    return NextResponse.json(
      { error: 'conflict', serverVersion: current },
      { status: 409 },
    );
  }

  return null;
}

/**
 * Idempotent delete: if the underlying delete throws NotFoundError, treat it as success.
 */
export async function idempotentDelete(deleteFn: () => Promise<void>): Promise<NextResponse> {
  try {
    await deleteFn();
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
