import { useEffect, useRef } from 'react';

const MIN_DISTANCE = 50;
const LOCK_THRESHOLD = 10;

export function useSwipeBack(
  el: HTMLElement | null,
  onSwipeBack: () => void,
  enabled: boolean,
): void {
  const callbackRef = useRef(onSwipeBack);
  useEffect(() => {
    callbackRef.current = onSwipeBack;
  }, [onSwipeBack]);

  useEffect(() => {
    if (!el || !enabled) {
      return;
    }

    let startX = 0;
    let startY = 0;
    let direction: 'horizontal' | 'vertical' | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        return;
      }

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      direction = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || direction === 'vertical') {
        return;
      }

      const deltaX = e.touches[0].clientX - startX;
      const deltaY = Math.abs(e.touches[0].clientY - startY);

      if (direction === null && (Math.abs(deltaX) > LOCK_THRESHOLD || deltaY > LOCK_THRESHOLD)) {
        direction = Math.abs(deltaX) > deltaY * 1.5 ? 'horizontal' : 'vertical';
      }

      if (direction === 'horizontal') {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (direction !== 'horizontal') {
        return;
      }

      const deltaX = e.changedTouches[0].clientX - startX;
      if (deltaX > MIN_DISTANCE) {
        callbackRef.current();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [el, enabled]);
}
