import { FileText, ListChecks } from 'lucide-react';
import { NOTES_PATH, TODOS_PATH } from '@/lib/pathConstants';

export const NAV_TABS = [
  { href: NOTES_PATH, label: 'Notizen', icon: FileText },
  { href: TODOS_PATH, label: 'Aufgaben', icon: ListChecks },
] as const;

export type NavTabHref = (typeof NAV_TABS)[number]['href'];

export function isTabActive(href: NavTabHref, pathname: string): boolean {
  const onTodos = pathname.startsWith(TODOS_PATH);
  return href === TODOS_PATH ? onTodos : !onTodos;
}
