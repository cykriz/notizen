import { FileText, ListChecks } from 'lucide-react';

export const NAV_TABS = [
  { href: '/notes', label: 'Notizen', icon: FileText },
  { href: '/todos', label: 'Aufgaben', icon: ListChecks },
] as const;

export type NavTabHref = (typeof NAV_TABS)[number]['href'];

export function isTabActive(href: NavTabHref, pathname: string): boolean {
  const onTodos = pathname.startsWith('/todos');
  return href === '/todos' ? onTodos : !onTodos;
}
