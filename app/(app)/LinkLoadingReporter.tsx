'use client';

import { useLinkStatus } from 'next/link';
import { useReportPending } from './navigationLoading';

/**
 * Rendered inside a `<Link>`; reports that Link's navigation pending state.
 * Must be a descendant of the `<Link>` for `useLinkStatus` to read its status.
 */
export function LinkLoadingReporter() {
  const { pending } = useLinkStatus();
  useReportPending(pending);
  return null;
}
