import { listNotes } from '@/lib/fsNotes';
import { listTodos } from '@/lib/fsTodos';

export const dynamic = 'force-dynamic';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CommandPaletteClient } from './CommandPaletteClient';
import { MobileBottomNav } from './MobileBottomNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [notes, todos] = await Promise.all([listNotes(), listTodos()]);

  return (
    <SidebarProvider>
      <AppSidebar notes={notes} todos={todos} />
      <CommandPaletteClient notes={notes} todos={todos} />
      <SidebarInset className="max-h-svh min-w-0">
        <div className="flex flex-1 flex-col min-h-0">{children}</div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
