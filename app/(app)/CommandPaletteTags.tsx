'use client';

import { FolderPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { TAG_CREATE_GROUP_LABEL, tagCreateLabel } from '@/lib/tagConstants';
import type { TagPathEntry } from '@/lib/tagTree';
import { TagFolderIcon } from './TagFolderIcon';

interface CommandPaletteTagsProps {
  entries: TagPathEntry[];
  /** The path an `@…` query would create, or null when there is nothing to create — see
   *  `tagCreateCandidate`. */
  createPath: string | null;
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
}

/**
 * The palette's `@` mode: existing tags, then the create row.
 *
 * The create row sits BELOW the matches on purpose. cmdk preselects the first row, so Enter has
 * to keep hitting the best existing tag — `@arb` still jumps to `arbeit`. The create row becomes
 * the preselected one exactly when nothing matches, which is when the user is typing a genuinely
 * new path.
 */
export function CommandPaletteTags({ entries, createPath, onSelect, onCreate }: CommandPaletteTagsProps) {
  return (
    <>
      {entries.length > 0 && (
        <CommandGroup heading="Tags">
          {entries.map((entry) => (
            <CommandItem
              key={entry.path}
              value={entry.path}
              onSelect={() => {
                onSelect(entry.path);
              }}
            >
              <TagFolderIcon />
              <span className="truncate">{entry.path}</span>
              <Badge variant="secondary" className="ml-auto text-xs px-1 py-0">
                {entry.noteCount}
              </Badge>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {/* The whole group is conditional, not just the row: with cmdk's filtering off it would
          never hide an empty group, leaving a bare "Neuer Tag" heading behind. */}
      {createPath !== null && (
        <CommandGroup heading={TAG_CREATE_GROUP_LABEL}>
          {/* `create:` prefix so the value cannot collide with a tag path above — with
              shouldFilter off, value is pure row identity. */}
          <CommandItem
            value={`create:${createPath}`}
            onSelect={() => {
              onCreate(createPath);
            }}
          >
            <FolderPlus />
            <span className="truncate">{tagCreateLabel(createPath)}</span>
          </CommandItem>
        </CommandGroup>
      )}
    </>
  );
}
