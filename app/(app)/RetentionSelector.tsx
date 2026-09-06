'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CANCEL_LABEL,
  DAY_MS,
  TRASH_DELETE_PERMANENT_LABEL,
  TRASH_RETENTION_LABEL,
  TRASH_RETENTION_OPTIONS,
} from '@/lib/constants';

// Module-scoped (reads the clock) so the component render stays pure.
function countOlderThan(trashedAtList: string[], days: number): number {
  const cutoff = Date.now() - days * DAY_MS;
  return trashedAtList.filter((t) => new Date(t).getTime() <= cutoff).length;
}

interface RetentionSelectorProps {
  retentionDays: number;
  trashedAtList: string[];
  onApply: (days: number) => Promise<void>;
}

export function RetentionSelector({ retentionDays, trashedAtList, onApply }: RetentionSelectorProps) {
  // Non-null while a shortened window awaits confirmation; count is the number
  // of items that would be purged immediately.
  const [pending, setPending] = useState<{ days: number; count: number } | null>(null);

  const handleChange = (value: string) => {
    const days = Number(value);
    const count = days < retentionDays ? countOlderThan(trashedAtList, days) : 0;
    if (count > 0) {
      setPending({ days, count });
    } else {
      void onApply(days).catch(console.error);
    }
  };

  const count = pending?.count ?? 0;
  // A retention value set outside the preset list (e.g. hand-edited settings)
  // still needs a matching item, else the trigger renders blank.
  const isPreset = TRASH_RETENTION_OPTIONS.some((o) => o.days === retentionDays);

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2 text-xs text-muted-foreground">
      <span>{TRASH_RETENTION_LABEL}</span>
      <Select value={String(retentionDays)} onValueChange={handleChange}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!isPreset && <SelectItem value={String(retentionDays)}>{retentionDays} Tage</SelectItem>}
          {TRASH_RETENTION_OPTIONS.map((o) => (
            <SelectItem key={o.days} value={String(o.days)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aufbewahrung verkürzen?</DialogTitle>
            <DialogDescription>
              {count} {count === 1 ? 'Eintrag wird' : 'Einträge werden'} sofort und unwiderruflich
              gelöscht.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{CANCEL_LABEL}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              autoFocus
              onClick={() => {
                const days = pending?.days;
                setPending(null);
                if (days !== undefined) {
                  void onApply(days).catch(console.error);
                }
              }}
            >
              {TRASH_DELETE_PERMANENT_LABEL}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
