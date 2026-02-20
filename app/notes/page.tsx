import { FileText } from "lucide-react";

export default function NotesPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <FileText className="h-12 w-12" />
        <p className="text-lg">Select a note to get started</p>
      </div>
    </div>
  );
}
