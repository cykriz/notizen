'use client';

import { useCallback, useState } from 'react';
import { PendingContext, PulseContext, PulseTickContext, ReportContext, type NavigationReportFn } from './navigationLoading';

/**
 * Holds a ref-counted "active navigations" count. `report` and `pending` live in
 * two separate contexts so a count change re-renders only the bar (PendingContext
 * consumer), never the potentially many reporters (which only need stable `report`).
 * The same split holds for one-shot glow pulses (e.g. after a todo change): stable
 * `pulse` in PulseContext, the pulse count in PulseTickContext.
 */
export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  const report = useCallback<NavigationReportFn>((active) => {
    setCount((n) => (active ? n + 1 : Math.max(0, n - 1)));
  }, []);

  const pulse = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  return (
    <ReportContext.Provider value={report}>
      <PulseContext.Provider value={pulse}>
        <PulseTickContext.Provider value={tick}>
          <PendingContext.Provider value={count > 0}>{children}</PendingContext.Provider>
        </PulseTickContext.Provider>
      </PulseContext.Provider>
    </ReportContext.Provider>
  );
}
