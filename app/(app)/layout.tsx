import { listNotes } from '@/lib/fsNotes';
import { listTodos } from '@/lib/fsTodos';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from './AppSidebar';
import { CommandPalette } from './CommandPalette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [notes, todos] = await Promise.all([listNotes(), listTodos()]);

  return (
    <SidebarProvider>
      <AppSidebar notes={notes} todos={todos} />
      <CommandPalette notes={notes} todos={todos} />
      <SidebarInset className="max-h-svh">
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium">Notizen</span>
        </header>
        <div className="flex flex-1 flex-col min-h-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
