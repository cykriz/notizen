'use client';

import { useEffect, useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar/context';
import { useIsMobile } from '@/hooks/use-mobile';

export function MobileSidebarOpener() {
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const hasOpened = useRef(false);

  useEffect(() => {
    if (isMobile && !hasOpened.current) {
      hasOpened.current = true;
      setOpenMobile(true);
    }
  }, [isMobile, setOpenMobile]);

  return null;
}
