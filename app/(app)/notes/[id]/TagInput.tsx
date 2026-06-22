'use client';

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { pathHasReservedSegment } from '@/lib/constants';
import { normalizeTagPath } from '@/lib/tagTree';
import { cn } from '@/lib/utils';
import { Tag } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { TagBadge } from './TagBadge';

interface TagInputProps {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
  compact?: boolean;
  onCollapse?: () => void;
}

export function TagInput({ tags, allTags, onChange, className, compact, onCollapse }: TagInputProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tagsLower = useMemo(() => tags.map((t) => t.toLowerCase()), [tags]);

  const suggestions = useMemo(() => {
    const isKnown = (t: string) => tagsLower.includes(t.toLowerCase());

    if (query === '') {
      return allTags.filter((t) => !isKnown(t));
    }

    const lower = query.toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(lower) && !isKnown(t));
  }, [query, allTags, tagsLower]);

  const addTag = (tag: string) => {
    const trimmed = normalizeTagPath(tag);
    if (trimmed === '' || pathHasReservedSegment(trimmed) || tags.some((t) => t.toLowerCase() === trimmed)) {
      return;
    }

    onChange([...tags, trimmed]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const replaceTag = (index: number, value: string) => {
    const trimmed = normalizeTagPath(value);
    const original = tags[index];
    if (trimmed === '' || pathHasReservedSegment(trimmed) || (trimmed !== original.toLowerCase() && tags.some((t) => t.toLowerCase() === trimmed))) {
      return;
    }

    if (trimmed !== original) {
      const next = [...tags];
      next[index] = trimmed;
      onChange(next);
    }
  };

  const showSuggestions = open && suggestions.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim() !== '') {
      if (!showSuggestions) {
        e.preventDefault();
        addTag(query);
      }
    }

    if (e.key === 'Backspace' && query === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }

    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      className={cn(
        'relative flex flex-row flex-wrap items-center gap-1.5 max-w-fit',
        { 'note-section-padding inset-shadow-sm': compact !== true },
        className,
      )}
    >
      <span className="flex justify-center items-center gap-2">
        <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground inline" />
        {tags.map((tag, i) => (
          <TagBadge
            key={`${i.toString()}-${tag}`}
            tag={tag}
            onReplace={(v) => {
              replaceTag(i, v);
            }}
            onRemove={() => {
              removeTag(tag);
            }}
          />
        ))}
      </span>
      <Command
        shouldFilter={false}
        loop
        className="relative inline w-16 focus-within:w-48 focus-within:flex-1 transition-all duration-150 overflow-visible bg-transparent h-auto rounded-none text-inherit"
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setOpen(false);
              onCollapse?.();
            }, 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tags…"
          rounded={false}
          className="h-7 md:h-6 border-none bg-transparent px-1 text-sm md:text-xs shadow-none focus-visible:ring-0"
        />
        {showSuggestions && (
          <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-md border bg-popover shadow-md">
            <CommandList>
              <CommandGroup>
                {suggestions.slice(0, 8).map((tag) => (
                  <CommandItem
                    key={tag}
                    value={tag}
                    onSelect={() => {
                      addTag(tag);
                    }}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandEmpty className="hidden" />
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}
