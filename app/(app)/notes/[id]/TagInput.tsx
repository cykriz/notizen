"use client";

import { useState, useRef, useMemo } from "react";
import { X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";

interface TagInputProps {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export function TagInput({ tags, allTags, onChange, className }: TagInputProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (query === "") {
      return allTags.filter((t) => !tags.includes(t));
    }

    const lower = query.toLowerCase();
    return allTags.filter(
      (t) => t.toLowerCase().includes(lower) && !tags.includes(t),
    );
  }, [query, allTags, tags]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase().replace(/\/+$/, "");
    if (trimmed === "" || tags.includes(trimmed)) {
      return;
    }

    onChange([...tags, trimmed]);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() !== "") {
      e.preventDefault();
      addTag(query);
    }

    if (e.key === "Backspace" && query === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }

    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative flex flex-wrap items-center gap-1.5 px-4 py-2", className)}>
      <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 text-xs">
          {tag}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              removeTag(tag); 
            }}
            className="ml-0.5 h-4 w-4 rounded-full"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      <div className="relative flex-1 min-w-[120px]">
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
            }, 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tag hinzufügen…"
          rounded={false}
          className="h-6 border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute left-0 top-7 z-50 w-56 rounded-md border bg-popover shadow-md">
            <Command>
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
            </Command>
          </div>
        )}
      </div>
    </div>
  );
}
