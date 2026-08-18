'use client';

import * as React from 'react';
import { Command as CommandPrimitive, useCommandState } from 'cmdk';
import { SearchIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md',
        className,
      )}
      // App-wide default: cmdk neither filters nor sorts. Its scorer would pull the CommandItem
      // `value` — a note id here — into the search haystack, and its sort re-appends rows in the
      // DOM behind React's back. Every list in this app ranks explicitly instead, see
      // lib/commandSearch.ts. Before the spread, so a caller can still opt back in.
      shouldFilter={false}
      {...props}
    />
  );
}

const COMMAND_DIALOG_CLASSES = [
  '**:[[cmdk-group-heading]]:text-muted-foreground',
  '**:data-[slot=command-input-wrapper]:h-12',
  '**:[[cmdk-group-heading]]:px-2',
  '**:[[cmdk-group-heading]]:font-medium',
  '**:[[cmdk-group]]:px-2',
  '[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0',
  '[&_[cmdk-input-wrapper]_svg]:h-5',
  '[&_[cmdk-input-wrapper]_svg]:w-5',
  '**:[[cmdk-input]]:h-12',
  '**:[[cmdk-item]]:px-2',
  '**:[[cmdk-item]]:py-3',
  '[&_[cmdk-item]_svg]:h-5',
  '[&_[cmdk-item]_svg]:w-5',
].join(' ');

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className={cn('overflow-hidden p-0', className)} showCloseButton={showCloseButton}>
        <Command className={COMMAND_DIALOG_CLASSES}>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-9 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}

// `ref` is deliberately not accepted: the internal one below owns the scroll reset, and a
// caller-supplied ref would have to be merged with it rather than silently replace it.
type CommandListProps = Omit<React.ComponentProps<typeof CommandPrimitive.List>, 'ref'>;

function CommandList({ className, ...props }: CommandListProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const search = useCommandState((state) => state.search);

  // cmdk scrolls only the *selected* row into view, and skips even that when the selection is
  // unchanged (its setState bails on Object.is). Nothing ever reset scrollTop, so scrolling by
  // wheel and then refining the query in a way that keeps the same row on top left the offset
  // untouched with the best hit above the fold — the reason the top result "wasn't there" until
  // you scrolled up. Every new query starts at the top instead. Keyed on `search`, not on the
  // selected value, so arrow-key navigation is untouched.
  //
  // This covers every list fed by `CommandInput`. TagInput drives its own `Input` instead, so
  // cmdk's `search` stays '' there and the reset never fires — harmless, its suggestion list is
  // capped at 8 rows and never scrolls.
  React.useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [search]);

  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn('max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto', className)}
      {...props}
      ref={listRef}
    />
  );
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-sm" {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        'text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium',
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('bg-border -mx-1 h-px', className)}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
