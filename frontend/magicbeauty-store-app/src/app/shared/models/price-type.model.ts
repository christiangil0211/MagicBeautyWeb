/** Catálogo sembrado en backend: Detal, Por mayor y Distribuidor. */
export interface PriceType {
  id: number;
  code: string;
  name: string;
  /** Precio de referencia: obligatorio en todo producto. */
  isDefault: boolean;
  /** Visible para usuarios no autenticados. Lo decide el backend, no la tienda. */
  isPublic: boolean;
  displayOrder: number;
  isActive: boolean;
}
