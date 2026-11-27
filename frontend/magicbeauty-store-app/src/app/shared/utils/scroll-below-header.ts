/** Aire entre la cabecera fija y el elemento al que se baja. */
const SCROLL_GAP_PX = 16;

/**
 * Desplaza la página hasta dejar el elemento justo bajo la cabecera fija de la
 * tienda (sticky con `top` negativo: solo una parte queda a la vista). Respeta
 * "reducir movimiento" y no hace nada fuera del navegador.
 */
export function scrollBelowHeader(element: HTMLElement | null | undefined, gap = SCROLL_GAP_PX): void {
  if (!element || typeof window === 'undefined' || typeof window.scrollTo !== 'function') return;

  const header = document.querySelector<HTMLElement>('.store-header');
  const headerOffset = header
    ? header.getBoundingClientRect().height + (parseFloat(getComputedStyle(header).top) || 0)
    : 0;
  const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - headerOffset - gap);
  if (Math.abs(window.scrollY - top) < 4) return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
}
