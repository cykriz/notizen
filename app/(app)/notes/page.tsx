import { FileText } from "lucide-react";
import { MobileSidebarOpener } from "./MobileSidebarOpener";

export default function NotesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 md:p-8 text-muted-foreground">
      <MobileSidebarOpener />
      <FileText className="h-12 w-12" />
      <p className="text-lg">Wähle eine Notiz aus, um zu beginnen</p>
    </div>
  );
}
