'use client';

import { useCallback, useState } from 'react';
import { PendingContext, ReportContext, type NavigationReportFn } from './navigationLoading';

/**
 * Holds a ref-counted "active navigations" count. `report` and `pending` live in
 * two separate contexts so a count change re-renders only the bar (PendingContext
 * consumer), never the potentially many reporters (which only need stable `report`).
 */
export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const report = useCallback<NavigationReportFn>((active) => {
    setCount((n) => (active ? n + 1 : Math.max(0, n - 1)));
  }, []);

  return (
    <ReportContext.Provider value={report}>
      <PendingContext.Provider value={count > 0}>{children}</PendingContext.Provider>
    </ReportContext.Provider>
  );
}
