import { useState, useEffect } from 'react';

const KEYBOARD_THRESHOLD = 100;

export function useKeyboardToolbar() {
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      return;
    }

    const update = () => {
      const raw = window.innerHeight - vv.height - vv.offsetTop;
      setBottomOffset(raw > KEYBOARD_THRESHOLD ? Math.round(raw) : 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return bottomOffset;
}
