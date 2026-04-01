'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface TagBadgeProps {
  tag: string;
  onReplace: (value: string) => void;
  onRemove: () => void;
}

export function TagBadge({ tag, onReplace, onRemove }: TagBadgeProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tag);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const confirm = () => {
    setEditing(false);
    onReplace(value);
  };

  const cancel = () => {
    setEditing(false);
    setValue(tag);
  };

  const startEdit = () => {
    setValue(tag);
    setEditing(true);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirm();
          }

          if (e.key === 'Escape') {
            cancel();
          }
        }}
        onBlur={confirm}
        rounded={false}
        className="h-6 w-28 border-none bg-secondary px-1.5 text-xs shadow-none focus-visible:ring-1"
      />
    );
  }

  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <span
        role="button"
        tabIndex={0}
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            startEdit();
          }
        }}
        className="cursor-pointer truncate max-w-32"
      >
        {tag}
      </span>
      <Button variant="ghost" size="icon-xs" onClick={onRemove} className="ml-0.5 h-4 w-4 rounded-full">
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}
