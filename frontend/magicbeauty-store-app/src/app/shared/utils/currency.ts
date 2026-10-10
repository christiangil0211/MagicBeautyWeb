const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

/** Pesos colombianos sin decimales, como se muestran en toda la tienda. */
export function formatCop(amount: number): string {
  return copFormatter.format(amount);
}
