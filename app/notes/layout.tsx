import { listNotes } from "@/lib/fsNotes";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotesSidebar } from "./NotesSidebar";

export default async function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const notes = await listNotes();

  return (
    <SidebarProvider>
      <NotesSidebar notes={notes} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium">Notizen</span>
        </header>
        <div className="flex flex-1 flex-col overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
