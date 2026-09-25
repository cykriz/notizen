import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { leafTagSegment } from '@/lib/tagTree';

/** Up to two leaf-tag badges — how a note's tags are shortened wherever a note is a single row.
 *  The first one pushes itself to the far end of its flex row. */
export function NoteTagBadges({ tags }: { tags: string[] }) {
  return tags.slice(0, 2).map((tag, i) => (
    <Badge key={tag} variant="secondary" className={cn('text-xs px-1 py-0', { 'ml-auto': i === 0 })}>
      {leafTagSegment(tag)}
    </Badge>
  ));
}
