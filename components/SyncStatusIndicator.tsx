"use client";

import { Cloud, CloudOff, CloudUpload } from "lucide-react";
import { useData } from "@/app/(app)/DataProvider";

export function SyncStatusIndicator() {
  const { isOnline, hasPendingSync } = useData();

  if (!isOnline) {
    return (
      <span title="Offline">
        <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    );
  }

  if (hasPendingSync) {
    return (
      <span title="Synchronisiere…">
        <CloudUpload className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
      </span>
    );
  }

  return (
    <span title="Synchronisiert">
      <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}
