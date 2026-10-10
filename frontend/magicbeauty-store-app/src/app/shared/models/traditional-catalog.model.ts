/** Catálogo tradicional tal como lo ve la tienda: solo activos. */
export interface PublicTraditionalCatalog {
  id: number;
  name: string;
  /** URL de inserción ya validada por el API (https://www.canva.com/design/…/view?embed). */
  canvaEmbedUrl: string;
  /** Enlace tal como se compartió desde Canva: "Abrir en Canva". */
  canvaShareUrl: string;
  /** Canva permite mostrarlo dentro de la tienda; si no, se abre en Canva. */
  canvaEmbeddable: boolean;
  coverImageUrl?: string | null;
  pdfUrl?: string | null;
}

/** Detalle de administración. */
export interface TraditionalCatalog extends PublicTraditionalCatalog {
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** La portada y el PDF no viajan aquí: se suben por sus propios endpoints. */
export interface SaveTraditionalCatalogRequest {
  name: string;
  /** Enlace de Canva como se comparte (canva.link, ver, editar o insertar) o el código de inserción. */
  canvaUrl: string;
  displayOrder: number;
  isActive: boolean;
}

export type TraditionalCatalogFile = 'cover' | 'pdf';
