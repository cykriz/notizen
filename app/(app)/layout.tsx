import { listNotes } from '@/lib/fsNotes';
import { listTodos } from '@/lib/fsTodos';

export const dynamic = 'force-dynamic';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CommandPaletteClient } from './CommandPaletteClient';
import { MobileBottomNav } from './MobileBottomNav';
import { DataProvider } from './DataProvider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let notes: Awaited<ReturnType<typeof listNotes>> = [];
  let todos: Awaited<ReturnType<typeof listTodos>> = [];

  try {
    [notes, todos] = await Promise.all([listNotes(), listTodos()]);
  } catch {
    // Offline — DataProvider will load from localStorage cache
  }

  return (
    <DataProvider initialNotes={notes} initialTodos={todos}>
      <SidebarProvider>
        <AppSidebar />
        <CommandPaletteClient />
        <SidebarInset className="max-h-svh min-w-0">
          <div className="flex flex-1 flex-col min-h-0">{children}</div>
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </DataProvider>
  );
}
