'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
}

// A labelled shadcn Select field (label + full-width select over options).
// Shared by the read-aloud panel (engine/voice) and the share menu (expiry).
export function LabeledSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
