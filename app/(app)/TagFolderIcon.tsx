import { Folder } from 'lucide-react';

// Das Icon jeder Zeile der Tag-Navigation. Bewusst OHNE Unterscheidung zwischen
// "hat Unter-Tags" und "hat keine": ein Ordner ist hier kein eigener Typ, sondern ein
// Tag, das gerade Unter-Tags trägt — das Icon würde sonst umkippen, sobald irgendwo ein
// Unter-Tag dazukommt, ohne dass sich an der Zeile etwas geändert hat. Ein leerer Ordner
// ist im Finder auch ein Ordner.
//
// Die Grenze, die zählt, ist Container gegen Notiz. Gefüllt und getönt wie ein
// macOS-Ordner setzt die Zeilen in der Sidebar gegen die Notiz-Einträge darunter ab, die
// gar kein Icon tragen; in der Command-Palette stehen Tag- und Notiz-Modus ohnehin nie
// zugleich, dort gibt das Icon nur den Typ der Trefferliste.
// Das sr-only-Label gibt Screenreadern denselben Hinweis, den sie sonst nur sehen könnten.
//
// Eine Quelle für Sidebar und Command-Palette, damit die beiden nicht auseinanderlaufen.
export function TagFolderIcon() {
  return (
    <>
      <Folder className="shrink-0 fill-current text-primary" />
      <span className="sr-only">Ordner</span>
    </>
  );
}
