import { listNotes } from '@/lib/fsNotes';
import { listTodos } from '@/lib/fsTodos';
import { getUserDataDir, isAuthEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CommandPaletteClient } from './CommandPaletteClient';
import { MobileBottomNav } from './MobileBottomNav';
import { DataProvider } from './DataProvider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = await isAuthEnabled();
  let notes: Awaited<ReturnType<typeof listNotes>> = [];
  let todos: Awaited<ReturnType<typeof listTodos>> = [];

  try {
    const root = await getUserDataDir();
    [notes, todos] = await Promise.all([listNotes(root), listTodos(root)]);
  } catch (err) {
    // Auth failure — redirect instead of showing empty shell
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      const { redirect } = await import('next/navigation');
      redirect('/login');
    }

    if (err instanceof Error && err.message.includes('No users configured')) {
      const { redirect } = await import('next/navigation');
      redirect('/setup');
    }

    // Offline — DataProvider will load from localStorage cache
  }

  return (
    <DataProvider initialNotes={notes} initialTodos={todos}>
      <SidebarProvider>
        <AppSidebar authEnabled={authEnabled} />
        <CommandPaletteClient />
        <SidebarInset className="max-h-svh min-w-0">
          <div className="flex flex-1 flex-col min-h-0">{children}</div>
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </DataProvider>
  );
}
