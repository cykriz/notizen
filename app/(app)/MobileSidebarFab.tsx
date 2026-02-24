'use client';

import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

export function MobileSidebarFab() {
  const { isMobile, toggleSidebar } = useSidebar();

  if (!isMobile) {
    return null;
  }

  return (
    <Button
      size="icon"
      variant="secondary"
      onClick={toggleSidebar}
      className="fixed bottom-4 left-4 z-50 h-10 w-10 rounded-full shadow-lg md:hidden"
    >
      <PanelLeft className="h-5 w-5" />
      <span className="sr-only">Seitenleiste öffnen</span>
    </Button>
  );
}
