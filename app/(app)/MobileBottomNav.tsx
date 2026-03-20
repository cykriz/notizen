'use client';

import { usePathname, useRouter } from 'next/navigation';
import { FileText, ListChecks } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/notes', label: 'Notizen', icon: FileText },
  { href: '/todos', label: 'Aufgaben', icon: ListChecks },
] as const;

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
      {tabs.map((tab) => {
        const isActive = tab.href === '/todos' ? pathname.startsWith('/todos') : !pathname.startsWith('/todos');

        return (
          <button
            key={tab.href}
            type="button"
            onClick={() => {
              handleTap(tab.href, isActive);
            }}
            className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors', {
              'text-primary': isActive,
              'text-muted-foreground': !isActive,
            })}
          >
            <tab.icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
