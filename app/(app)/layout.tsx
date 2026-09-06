import { listNotes } from '@/lib/fsNotes';
import { listTodos } from '@/lib/fsTodos';
import { getUserDataDir, isAuthEnabled, NoUsersConfiguredError, UnauthorizedError } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LOGIN_PATH, SETUP_PATH } from '@/lib/pathConstants';

export const dynamic = 'force-dynamic';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CommandPaletteClient } from './CommandPaletteClient';
import { MobileBottomNav } from './MobileBottomNav';
import { DataProvider } from './DataProvider';
import { ViewportEffects } from './ViewportEffects';
import { NavigationLoadingProvider } from './NavigationLoadingProvider';
import { NoteLoadingBar } from './NoteLoadingBar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = await isAuthEnabled();
  let notes: Awaited<ReturnType<typeof listNotes>> = [];
  let todos: Awaited<ReturnType<typeof listTodos>> = [];

  try {
    const root = await getUserDataDir();
    [notes, todos] = await Promise.all([listNotes(root), listTodos(root)]);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect(LOGIN_PATH);
    }

    if (err instanceof NoUsersConfiguredError) {
      redirect(SETUP_PATH);
    }

    // Offline — DataProvider will load from localStorage cache
  }

  return (
    <DataProvider initialNotes={notes} initialTodos={todos}>
      <ViewportEffects />
      <NavigationLoadingProvider>
        <SidebarProvider>
          <AppSidebar authEnabled={authEnabled} />
          <CommandPaletteClient />
          <SidebarInset className="max-h-(--app-h) min-w-0">
            <div className="flex flex-1 flex-col min-h-0">
              <div className="relative">
                <NoteLoadingBar />
              </div>
              {children}
            </div>
            <MobileBottomNav />
          </SidebarInset>
        </SidebarProvider>
      </NavigationLoadingProvider>
    </DataProvider>
  );
}
