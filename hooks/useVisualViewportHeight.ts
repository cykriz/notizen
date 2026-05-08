import { useEffect } from 'react';

// Below this many px of occluded viewport we assume URL-bar resize, not the keyboard.
const KEYBOARD_THRESHOLD = 100;

export function useVisualViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    if (!vv) {
      return;
    }

    const update = () => {
      // Include offsetTop so the app shell extends down to the top of the keyboard
      // even when iOS Safari has scrolled the document to keep the focused input visible.
      const appHeight = Math.round(vv.height + vv.offsetTop);
      root.style.setProperty('--app-h', `${appHeight.toString()}px`);
      const occluded = window.innerHeight - vv.height - vv.offsetTop;
      if (occluded > KEYBOARD_THRESHOLD) {
        root.dataset.keyboardOpen = 'true';
      } else {
        delete root.dataset.keyboardOpen;
      }
    };

    let raf = 0;
    const schedule = () => {
      if (raf !== 0) {
        return;
      }

      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    update();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);

    return () => {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      if (raf !== 0) {
        cancelAnimationFrame(raf);
      }

      delete root.dataset.keyboardOpen;
      root.style.removeProperty('--app-h');
    };
  }, []);
}
