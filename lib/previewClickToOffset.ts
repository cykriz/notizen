/**
 * Finds the source offset of the nearest annotated element
 * by walking up from the click target.
 */
export function getSourceOffsetFromClick(target: HTMLElement): number | null {
  let el: HTMLElement | null = target;
  while (el) {
    const attr = el.getAttribute('data-source-offset');
    if (attr !== null) {
      return Number(attr);
    }

    el = el.parentElement;
  }
  return null;
}
