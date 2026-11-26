/**
 * Pasado este tiempo sin respuesta del API, una sección del inicio muestra su
 * respaldo. El API puede tardar varios segundos en despertar; la clienta no debe
 * quedarse esperando.
 */
export const HOME_API_TIMEOUT_MS = 10_000;

/** loading: casillas de carga · ready: datos · fallback: respaldo estático en el mismo alto. */
export type HomeSectionState = 'loading' | 'ready' | 'fallback';
