'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { NAV_TABS, isTabActive } from './navTabs';
import { paletteStore } from './paletteStore';

type NavTab = (typeof NAV_TABS)[number];

// The bar is a fixed three-slot layout — tab, search, tab — so the tabs are named rather than
// mapped. `satisfies` is the gate: AppSidebarHeader maps NAV_TABS and would absorb a third tab
// silently, where this destructuring would just drop it. A third entry is a type error instead.
const [notesTab, todosTab] = NAV_TABS satisfies readonly [NavTab, NavTab];

interface NavTabButtonProps {
  tab: NavTab;
  isActive: boolean;
  onClick: () => void;
  /** Which end is the outer one — the rounded corners and the arc cut out for the search circle. */
  className: string;
}

// Its own surface, not a segment of a shared one: the search circle overlaps both buttons, and the
// masks in `.nav-cutout-*` cut its clearance out of them.
function NavTabButton({ tab, isActive, onClick, className }: NavTabButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={cn('bg-sidebar h-14 flex-1 flex-col gap-0.5 text-xs', className, {
        'text-primary': isActive,
        'text-muted-foreground': !isActive,
      })}
    >
      <tab.icon className="h-5 w-5" />
      <span>{tab.label}</span>
    </Button>
  );
}

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

  const notesActive = isTabActive(notesTab.href, pathname);
  const todosActive = isTabActive(todosTab.href, pathname);

  return (
    // Three surfaces, so the row is `h-16` while the tabs stay `h-14`: that difference is what lets
    // the search circle stand above them instead of being flush. No `gap` — the circle overlaps the
    // tabs and its clearance is cut out of them instead, see `.nav-cutout-*`.
    //
    // The safe-area inset is a margin, not padding: as padding it would eat into the fixed height
    // and squeeze the children on devices that have one.
    //
    // lg, not md: this is the breakpoint below which the sidebar is a Sheet (`useIsMobile`), so
    // between 768px and 1023px the bar used to be gone while nothing had replaced it.
    <nav
      aria-label="Hauptnavigation"
      className="bottom-nav mx-2 mb-[calc(0.5rem+env(safe-area-inset-bottom))] flex h-16 shrink-0 items-center lg:hidden z-10 in-data-keyboard-open:hidden"
    >
      <NavTabButton
        tab={notesTab}
        isActive={notesActive}
        onClick={() => {
          handleTap(notesTab.href, notesActive);
        }}
        className="rounded-l-xl nav-cutout-right"
      />
      {/* The only pointer-driven way into the palette: without a Mod key, Mod+P is unreachable.
          Sets `true` rather than toggling — with the dialog open its overlay covers this bar, so
          a tap can never mean "close". */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Suchen"
        onClick={() => {
          paletteStore.set(true);
        }}
        className="bg-sidebar text-muted-foreground size-(--nav-search) mx-[calc(var(--nav-search-overlap)*-1)] rounded-full shadow-sm"
      >
        {/* `size-6`, not `h-6 w-6` as on the tabs: the button's own
            `[&_svg:not([class*='size-'])]:size-4` would otherwise win over it. */}
        <Search className="size-6" />
      </Button>
      <NavTabButton
        tab={todosTab}
        isActive={todosActive}
        onClick={() => {
          handleTap(todosTab.href, todosActive);
        }}
        className="rounded-r-xl nav-cutout-left"
      />
    </nav>
  );
}
