'use client';

import { createContext, useContext, useEffect, useMemo, useTransition } from 'react';

export type NavigationReportFn = (active: boolean) => void;

export const ReportContext = createContext<NavigationReportFn | null>(null);
export const PendingContext = createContext(false);

export function useNavigationLoadingPending(): boolean {
  return useContext(PendingContext);
}

export function useNavigationLoadingReporter(): NavigationReportFn {
  const report = useContext(ReportContext);
  if (!report) {
    throw new Error('useNavigationLoadingReporter must be used within NavigationLoadingProvider');
  }

  return report;
}

/** Reports a boolean pending state to the shared count for its lifetime. */
export function useReportPending(pending: boolean): void {
  const report = useNavigationLoadingReporter();
  useEffect(() => {
    if (!pending) {
      return;
    }

    report(true);
    return () => {
      report(false);
    };
  }, [pending, report]);
}

/**
 * Wraps `useTransition` and reports its pending state. Use for `router.push`
 * navigations: `start(() => router.push(...))` stays pending until the new
 * route's RSC resolves.
 */
export function useReportedTransition(): (callback: () => void) => void {
  const [isPending, startTransition] = useTransition();
  useReportPending(isPending);
  return useMemo(
    () => (callback: () => void) => {
      startTransition(callback);
    },
    [],
  );
}
