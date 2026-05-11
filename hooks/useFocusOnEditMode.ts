import { useEffect, type RefObject } from 'react';
import type { MarkdownEditorHandle } from '@/components/MarkdownEditor';
import { PREVIEW_EDIT } from '@/lib/constants';
import type { PreviewMode } from '@/lib/types';

interface UseFocusOnEditModeOptions {
  editorRef: RefObject<MarkdownEditorHandle | null>;
  preview: PreviewMode;
}

export function useFocusOnEditMode({ editorRef, preview }: UseFocusOnEditModeOptions) {
  useEffect(() => {
    if (preview !== PREVIEW_EDIT) {
      return;
    }

    const handle = requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [editorRef, preview]);
}
