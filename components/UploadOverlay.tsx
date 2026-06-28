import { Progress } from '@/components/ui/progress';
import { formatUploadLabel, type UploadProgress } from '@/lib/attachmentUpload';

interface UploadOverlayProps {
  progress: UploadProgress | null;
}

export function UploadOverlay({ progress }: UploadOverlayProps) {
  if (progress === null) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 px-6"
      aria-live="polite"
    >
      <p className="max-w-full truncate text-sm font-medium text-muted-foreground">{formatUploadLabel(progress)}</p>
      <Progress value={progress.percent} className="max-w-xs" />
      <p className="text-sm font-medium text-muted-foreground">{progress.percent} %</p>
    </div>
  );
}
