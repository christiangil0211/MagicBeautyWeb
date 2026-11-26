/**
 * Preparación común de las pruebas unitarias (jsdom).
 *
 * jsdom no trae IntersectionObserver, que usan los bloques `@defer (on viewport)`
 * del inicio. Este reemplazo nunca avisa que algo entró en pantalla: en las pruebas
 * de rutas esos bloques se quedan en su marcador, y las pruebas que necesitan el
 * contenido lo cargan a mano con `DeferBlockBehavior.Manual`.
 */
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

globalThis.IntersectionObserver ??= IntersectionObserverStub as unknown as typeof IntersectionObserver;
