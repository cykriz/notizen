'use client';

import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DO_LIMIT } from '@/lib/todoColumns';

/**
 * The board's house rules, collapsed by default.
 *
 * SELF-CONTAINED ON PURPOSE — this is a crutch, not a feature, and is meant to be
 * thrown away once the rules are habit. Removing it is two steps: delete this file
 * and delete the single <TodoRules /> line in TodoBoard.tsx. Nothing else imports
 * it, it takes no props, and it reaches into no board internals. Keep it that way.
 *
 * No persisted open/closed state, deliberately: that would mean a localStorage read
 * during render and the useClientMounted dance that comes with it, for a panel one
 * click away.
 */
export function TodoRules() {
  return (
    <Collapsible className="mx-3 mt-2">
      <CollapsibleTrigger className="group flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent/50">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
        Regeln
      </CollapsibleTrigger>
      <CollapsibleContent className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <ul className="space-y-1">
          <li>
            <strong className="font-medium text-foreground">Erfassen:</strong> Alles landet zuerst im Eingang. Niemals
            direkt sortieren oder bewerten.
          </li>
          <li>
            <strong className="font-medium text-foreground">{DO_LIMIT}-Slot-Regel:</strong> „Erledigen&ldquo; hat {DO_LIMIT} Slots. Ein freier
            Slot darf befüllt werden — Slot 1 muss nicht fertig sein, bevor Slot 2 startet.
          </li>
          <li>
            <strong className="font-medium text-foreground">Einplanen = Kalender:</strong> Terminierbares wird direkt im
            Kalender eingeplant und hier gelöscht. Es gibt keine Spalte für Eingeplantes.
          </li>
          <li>
            <strong className="font-medium text-foreground">Wochenritual (Mittwoch, 10 Min):</strong> Eingang durchgehen,
            pro Eintrag genau eine Option — nach „Erledigen&ldquo; ziehen (nur bei freiem Slot), in den Kalender einplanen und
            hier löschen, oder löschen (Impuls, kein Auftrag). Danach kurz auf „Erledigt&ldquo; schauen und die Spalte leeren.
          </li>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
