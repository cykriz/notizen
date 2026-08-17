import { cn } from '@/lib/utils';
import { Folder, Tag } from 'lucide-react';

interface TagNodeIconProps {
  isFolder: boolean;
  /**
   * Farbe des Blatt-Icons — hängt an der Oberfläche und muss deshalb von außen kommen:
   * die Sidebar dimmt mit ihrem eigenen `--sidebar-foreground`-Token, die Command-Palette
   * lässt das Prop bewusst weg, weil `CommandItem` jedes svg ohne eigene `text-`-Klasse
   * schon auf `text-muted-foreground` setzt. Ein Wert hier würde sie da herauslösen.
   */
  leafClassName?: string;
}

// Ordner = gefüllt + Primärfarbe, Blatt-Tag = Outline + gedimmt. Redundant kodiert
// (Silhouette UND Farbe), damit die Unterscheidung nicht allein an der Farbe hängt.
//
// Gilt für Listen, in denen beide Typen nebeneinander stehen — dort ist die Füllung ein
// Unterscheidungsmerkmal. Reine Ordner-Listen (das Pfad-Popover in TagBreadcrumb) behalten
// bewusst das neutrale Outline-Icon: wo alles ein Ordner ist, kodiert die Füllung nichts
// und wäre nur Lärm.
//
// Das sr-only-Label gibt Screenreadern den Typ, den es sonst nur visuell gäbe.
// Bewusst nur am Ordner: "Tag" ist im Deutschen mehrdeutig und würde vorgelesen stören —
// markiert wird der auffällige Fall, der Rest ist der Default.
export function TagNodeIcon({ isFolder, leafClassName }: TagNodeIconProps) {
  if (isFolder) {
    return (
      <>
        <Folder className="shrink-0 fill-current text-primary" />
        <span className="sr-only">Ordner</span>
      </>
    );
  }

  return <Tag className={cn('shrink-0', leafClassName)} />;
}
