'use client';

import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ClearableDateInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export const ClearableDateInput = forwardRef<HTMLInputElement, ClearableDateInputProps>(
  function ClearableDateInput({ id, value, onChange }, ref) {
    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type="date"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
        {value !== '' && (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange('');
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
