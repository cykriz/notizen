import { useCallback, useEffect, useMemo, useRef } from 'react';

import { InternalLinkRenderer } from '@/components/InternalLink';
import { PreviewCheckbox } from '@/components/PreviewCheckbox';

interface UsePreviewCheckboxResult {
  checkboxCtx: { getSource: () => string; onChange: (v: string) => void };
  previewComponents: { a: typeof InternalLinkRenderer; input: typeof PreviewCheckbox };
}

export function usePreviewCheckbox(value: string, onChange: (v: string) => void): UsePreviewCheckboxResult {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const getSource = useCallback(() => valueRef.current, []);
  const stableOnChange = useCallback((v: string) => {
    onChangeRef.current(v); 
  }, []);
  const checkboxCtx = useMemo(() => ({ getSource, onChange: stableOnChange }), [getSource, stableOnChange]);
  const previewComponents = useMemo(
    () => ({ a: InternalLinkRenderer, input: PreviewCheckbox }),
    [],
  );

  return { checkboxCtx, previewComponents };
}
