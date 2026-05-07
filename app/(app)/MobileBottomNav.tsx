'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { NAV_TABS, isTabActive } from './navTabs';

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar } = useSidebar();

  function handleTap(href: string, isActive: boolean) {
    if (isActive) {
      toggleSidebar();
    } else {
      router.push(href);
    }
  }

  return (
    <nav className="card-base mx-2 mb-2 flex h-14 shrink-0 items-center bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden z-10">
      {NAV_TABS.map((tab) => {
        const isActive = isTabActive(tab.href, pathname);

        return (
          <Button
            key={tab.href}
            type="button"
            variant="ghost"
            onClick={() => {
              handleTap(tab.href, isActive);
            }}
            className={cn('flex-1 flex-col h-full gap-0.5 text-xs rounded-none', {
              'text-primary': isActive,
              'text-muted-foreground': !isActive,
            })}
          >
            <tab.icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
