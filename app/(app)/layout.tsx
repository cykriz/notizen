import { listNotes } from '@/lib/fsNotes';
import { listTodos } from '@/lib/fsTodos';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CommandPalette } from './CommandPalette';
import { MobileSidebarFab } from './MobileSidebarFab';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [notes, todos] = await Promise.all([listNotes(), listTodos()]);

  return (
    <SidebarProvider>
      <AppSidebar notes={notes} todos={todos} />
      <CommandPalette notes={notes} todos={todos} />
      <SidebarInset className="max-h-svh">
        <div className="flex flex-1 flex-col min-h-0">{children}</div>
      </SidebarInset>
      <MobileSidebarFab />
    </SidebarProvider>
  );
}
