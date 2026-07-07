import { Slash, Trash2 } from 'lucide-react';

// Durchgestrichene Mülltonne ("Papierkorb verlassen"): lucide hat kein trash-off-Icon,
// daher Trash2 + überlagerter Slash. Die inneren svg bekommen keine size-Klasse und erben
// so die Icon-Größe des jeweiligen Buttons (icon-xs → size-3, sm → size-4). Der dickere
// Slash in Sidebar-Hintergrundfarbe schneidet eine Lücke, damit der Strich klar trennt.
//
// Setzt einen Ghost-Host-Button mit `group` voraus: der Cutout muss den effektiven
// Button-Hintergrund treffen (Ruhe = sidebar, Hover = accent). Bei anderem Host anpassen.
export function TrashOffIcon() {
  return (
    <span className="relative inline-flex shrink-0">
      <Trash2 />
      <Slash className="absolute inset-0 text-sidebar group-hover:text-accent" strokeWidth={4} />
      <Slash className="absolute inset-0" />
    </span>
  );
}
