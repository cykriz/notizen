'use client';

import { useState } from 'react';
import { Check, ChevronDown, Copy, ExternalLink, FileText, ListTodo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SYNC_ENTITY } from '@/lib/constants';
import {
  FAILED_SYNC_ACTION_LABEL,
  FAILED_SYNC_COPY_LABEL,
  FAILED_SYNC_ENTITY_LABEL,
  FAILED_SYNC_OPEN_NOTE_LABEL,
  FAILED_SYNC_OPEN_TODOS_LABEL,
} from '@/lib/failedSyncConstants';
import type { FailedSyncDetail } from '@/lib/failedSyncDetail';
import { FailedSyncRowActions } from './FailedSyncRowActions';
import { FailedSyncRowDetails } from './FailedSyncRowDetails';

interface FailedSyncRowProps {
  detail: FailedSyncDetail;
  isOnline: boolean;
  isCopied: boolean;
  // True while this is the only entry left, which auto-expands it.
  soleEntry: boolean;
  onOpen: (detail: FailedSyncDetail) => void;
  onPush: (detail: FailedSyncDetail) => void;
  onCopy: (detail: FailedSyncDetail) => void;
  onDiscard: (detail: FailedSyncDetail) => void;
}

export function FailedSyncRow({
  detail,
  isOnline,
  isCopied,
  soleEntry,
  onOpen,
  onPush,
  onCopy,
  onDiscard,
}: FailedSyncRowProps) {
  const isNote = detail.entityType === SYNC_ENTITY.NOTE;
  // Controlled, because Collapsible reads `defaultOpen` once per mount and the
  // row's key is stable: discarding one of two entries left the survivor
  // collapsed even though it had become the only one. Expanding only on the
  // false -> true edge keeps a manual collapse sticky.
  // Adjusted during render rather than in an effect (same pattern as
  // FailedSyncDialog's prevOpen sentinel) — react-hooks/set-state-in-effect.
  const [open, setOpen] = useState(soleEntry);
  const [prevSole, setPrevSole] = useState(soleEntry);
  if (prevSole !== soleEntry) {
    setPrevSole(soleEntry);
    if (soleEntry) {
      setOpen(true);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border p-2">
      {/* items-start, not items-center: the trigger is two lines and its cause can
          wrap to a third, which would otherwise drag the action icons down with it. */}
      <div className="flex items-start gap-2">
        <CollapsibleTrigger asChild>
          {/* No aria-label: it would REPLACE the accessible name, announcing every
              row as "Details anzeigen" and hiding the title, type, action and
              cause. The visible content is the better name.

              `shrinkable` + `whitespace-normal` undo buttonVariants' base
              `shrink-0`/`whitespace-nowrap`. Without them the button keeps its
              single-line intrinsic width, so the cause overflows the row and
              slides under the action icons — which is how a click meant for
              "Erneut versuchen" could land on "Verwerfen". */}
          <Button
            variant="ghost"
            shrinkable
            className="group h-auto flex-1 items-start justify-start gap-2 whitespace-normal px-1 py-1 text-left"
          >
            {isNote ? <FileText className="mt-0.5 shrink-0" /> : <ListTodo className="mt-0.5 shrink-0" />}
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="flex w-full min-w-0 items-center gap-2">
                {/* Badges carry shrink-0 from badgeVariants, so the title is what
                    gives way on narrow widths. */}
                <span className="min-w-0 truncate text-sm font-medium">{detail.title}</span>
                {/* Entity type spelled out: failed todos have no other marker
                    anywhere in the app, unlike notes' sync-fehler folder. */}
                <Badge variant="secondary">{FAILED_SYNC_ENTITY_LABEL[detail.entityType]}</Badge>
                <Badge variant="outline">{FAILED_SYNC_ACTION_LABEL[detail.action]}</Badge>
              </span>
              {/* Always visible: which entry and why, without expanding anything. */}
              <span className="text-xs text-destructive">{detail.cause.cause}</span>
            </span>
            <ChevronDown className="mt-0.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>

        {/* Utility icons only. The two resolving options get their own line below,
            where they have room for real labels. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              onOpen(detail);
            }}
            aria-label={isNote ? FAILED_SYNC_OPEN_NOTE_LABEL : FAILED_SYNC_OPEN_TODOS_LABEL}
            title={isNote ? FAILED_SYNC_OPEN_NOTE_LABEL : FAILED_SYNC_OPEN_TODOS_LABEL}
          >
            <ExternalLink />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              onCopy(detail);
            }}
            aria-label={FAILED_SYNC_COPY_LABEL}
            title={FAILED_SYNC_COPY_LABEL}
          >
            {isCopied ? <Check /> : <Copy />}
          </Button>
        </div>
      </div>

      <CollapsibleContent>
        <FailedSyncRowDetails detail={detail} />
      </CollapsibleContent>

      <FailedSyncRowActions detail={detail} isOnline={isOnline} onPush={onPush} onDiscard={onDiscard} />
    </Collapsible>
  );
}
