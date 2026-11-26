import { CatalogProductListItem } from './product.model';

/** Marca vista desde el administrador. */
export interface Brand {
  id: number;
  name: string;
  /** Forma la URL pública /marcas/{slug}. */
  slug: string;
  /** Un solo logo por marca; null si todavía no se cargó. */
  logoUrl?: string | null;
  description?: string | null;
  isFeatured: boolean;
  sortOrder: number;
  isActive: boolean;
  /** Productos con esta marca (activos e inactivos). */
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandRequest {
  name: string;
  /** Vacío: el API lo genera desde el nombre. */
  slug?: string | null;
  description?: string | null;
  isFeatured: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface UpdateBrandRequest extends CreateBrandRequest {}

/** Qué productos lista la gestión de una marca. */
export type BrandProductScope = 'all' | 'without-brand' | 'in-brand';

export interface BrandProductItem {
  id: number;
  reference: string;
  name: string;
  isActive: boolean;
  mainImageUrl?: string | null;
  /** Marca actual; null si no tiene. */
  brandId?: number | null;
  brandName?: string | null;
}

export interface BrandProductsPage {
  items: BrandProductItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Producto que ya tiene otra marca: el API pide confirmar antes de moverlo. */
export interface BrandAssignmentConflict {
  productId: number;
  reference: string;
  name: string;
  currentBrandId: number;
  currentBrandName: string;
}

/** Marca en la tienda pública: activa y con productos completos. */
export interface PublicBrand {
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  isFeatured: boolean;
  productCount: number;
}

export interface PublicBrandPage {
  brand: PublicBrand;
  products: CatalogProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}
