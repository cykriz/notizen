import { FileText } from 'lucide-react';
import { PinnedNotesOverview } from './PinnedNotesOverview';

export default function NotesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center-safe gap-8 overflow-y-auto p-4 md:p-8 text-muted-foreground">
      <div className="flex flex-col items-center gap-4">
        <FileText className="h-12 w-12" />
        <p className="text-lg">Wähle eine Notiz aus, um zu beginnen</p>
      </div>
      <PinnedNotesOverview />
    </div>
  );
}
