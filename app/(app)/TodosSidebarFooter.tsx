'use client';

import { useSyncExternalStore } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarFooter } from '@/components/ui/sidebar';
import { PAPIERKORB_LABEL, TODOS_OVERVIEW_LABEL } from '@/lib/constants';
import { TrashOffIcon } from './TrashOffIcon';
import { todosViewStore } from './todosViewStore';

export function TodosSidebarFooter() {
  const view = useSyncExternalStore(
    todosViewStore.subscribe,
    todosViewStore.getSnapshot,
    todosViewStore.getServerSnapshot,
  );
  const toTrash = view !== 'trash';

  return (
    <SidebarFooter>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="group flex-1 justify-start has-[>span]:px-2.5"
          onClick={() => {
            todosViewStore.set(toTrash ? 'trash' : 'overview');
          }}
        >
          {toTrash ? <Trash2 /> : <TrashOffIcon />}
          {toTrash ? PAPIERKORB_LABEL : TODOS_OVERVIEW_LABEL}
        </Button>
      </div>
    </SidebarFooter>
  );
}
