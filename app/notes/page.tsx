import { FileText } from "lucide-react";

export default function NotesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-muted-foreground">
      <FileText className="h-12 w-12" />
      <p className="text-lg">Select a note to get started</p>
    </div>
  );
}
