import { Slash, Trash2 } from 'lucide-react';

// Crossed-out trash can ("leave the trash"): lucide has no trash-off icon, so Trash2 plus an
// overlaid Slash. The inner svgs get no size class and therefore inherit the icon size of their
// button (icon-xs → size-3, sm → size-4). The thicker slash in the sidebar background color cuts
// a gap so the stroke separates clearly.
//
// Assumes a ghost host button with `group`: the cutout has to match the effective button
// background (idle = sidebar, hover = accent). Adjust for a different host.
export function TrashOffIcon() {
  return (
    <span className="relative inline-flex shrink-0">
      <Trash2 />
      <Slash className="absolute inset-0 text-sidebar group-hover:text-accent" strokeWidth={4} />
      <Slash className="absolute inset-0" />
    </span>
  );
}
