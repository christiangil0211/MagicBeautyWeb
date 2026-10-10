/** Fila del listado de administración. */
export interface ProductListItem {
  id: number;
  reference: string;
  name: string;
  brandId: number;
  brandName: string;
  hasVariants: boolean;
  isActive: boolean;
  totalQuantity: number;
  defaultPrice?: number | null;
  mainImageUrl?: string | null;
  categories: string[];
}

export interface ProductCategoryLink {
  categoryId: number;
  name: string;
  slug: string;
}

export interface ProductPrice {
  id: number;
  priceTypeId: number;
  priceTypeCode: string;
  priceTypeName: string;
  isDefaultPriceType: boolean;
  amount: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  code?: string | null;
  colorHex?: string | null;
  quantity: number;
  displayOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: number;
  productId: number;
  productVariantId?: number | null;
  url: string;
  altText?: string | null;
  displayOrder: number;
  isMain: boolean;
  isActive: boolean;
}

export interface InventoryMovement {
  id: number;
  productVariantId: number;
  type: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string | null;
  createdAt: string;
}

/** Detalle completo de administración. */
export interface Product {
  id: number;
  reference: string;
  name: string;
  description?: string | null;
  brandId: number;
  brandName: string;
  hasVariants: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categories: ProductCategoryLink[];
  prices: ProductPrice[];
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface UpsertProductPriceRequest {
  priceTypeId: number;
  amount: number;
  isActive: boolean;
}

export interface CreateProductVariantRequest {
  name: string;
  code?: string | null;
  colorHex?: string | null;
  quantity: number;
  displayOrder: number;
}

export interface CreateProductRequest {
  reference: string;
  name: string;
  description?: string | null;
  brandId: number;
  hasVariants: boolean;
  isActive: boolean;
  /** Solo se usa cuando hasVariants es false: el backend crea la variante interna. */
  initialQuantity: number;
  categoryIds: number[];
  prices: UpsertProductPriceRequest[];
  variants: CreateProductVariantRequest[];
}

/** Reference y hasVariants son inmutables, por eso no viajan en el update. */
export interface UpdateProductRequest {
  name: string;
  description?: string | null;
  brandId: number;
  isActive: boolean;
}

/** Quantity no viaja aquí: las existencias solo cambian por el endpoint de inventario. */
export interface UpdateProductVariantRequest {
  name: string;
  code?: string | null;
  colorHex?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export type InventoryMovementCode = 'IN' | 'SALE_ONLINE' | 'SALE_PHYSICAL' | 'ADJUSTMENT';

export interface AdjustInventoryRequest {
  type: InventoryMovementCode;
  quantity: number;
  reason?: string | null;
}

export interface ProductImageRequest {
  url: string;
  altText?: string | null;
  productVariantId?: number | null;
  displayOrder: number;
  isMain: boolean;
  isActive: boolean;
}

/* ===== Tienda ===== */

/**
 * Precio que la audiencia actual puede ver. El backend decide cuáles llegan y en
 * qué orden: la tienda los pinta tal cual, sin conocer los códigos de antemano.
 */
export interface CatalogPrice {
  priceTypeCode: string;
  priceTypeName: string;
  amount: number;
}

/** Fila del listado público de catálogo. */
export interface CatalogProductListItem {
  id: number;
  reference: string;
  name: string;
  brandName: string;
  hasVariants: boolean;
  availableQuantity: number;
  mainImageUrl?: string | null;
  /** Categorías asignadas directamente; los filtros suman las subcategorías. */
  categoryIds: number[];
  prices: CatalogPrice[];
}

/**
 * Contrato de presentación de la tarjeta pública. Es deliberadamente distinto de
 * `ProductListItem`: la tienda no recibe conceptos de administración como
 * `isActive`, y sus precios son solo los autorizados para quien navega.
 */
export interface ProductCardModel {
  id: number;
  reference: string;
  name: string;
  brandName: string;
  prices: CatalogPrice[];
  mainImageUrl?: string | null;
  inStock: boolean;
  hasVariants: boolean;
  badge?: string | null;
  isFavorite?: boolean;
}

/**
 * Adapta una fila del catálogo público a la tarjeta. Vive aquí para que el Home,
 * la vitrina y los relacionados compartan exactamente la misma regla.
 */
export function toProductCard(product: CatalogProductListItem): ProductCardModel {
  return {
    id: product.id,
    reference: product.reference,
    name: product.name,
    brandName: product.brandName,
    prices: product.prices,
    mainImageUrl: product.mainImageUrl,
    inStock: product.availableQuantity > 0,
    hasVariants: product.hasVariants,
    badge: product.hasVariants ? 'Tonos' : null
  };
}

/* ===== Ficha pública ===== */

export interface ProductDetailCategory {
  id: number;
  name: string;
  slug: string;
}

export interface ProductDetailImage {
  id: number;
  /** Null cuando la imagen es general del producto. */
  productVariantId?: number | null;
  url: string;
  altText?: string | null;
  displayOrder: number;
  isMain: boolean;
}

export interface ProductDetailVariant {
  id: number;
  name: string;
  code?: string | null;
  colorHex?: string | null;
  quantity: number;
  displayOrder: number;
}

/**
 * Lo que la tienda recibe de un producto. Nunca incluye la variante interna ni
 * precios que quien consulta no tenga autorizados.
 */
export interface ProductDetail {
  id: number;
  reference: string;
  name: string;
  description?: string | null;
  brandName: string;
  prices: CatalogPrice[];
  hasVariants: boolean;
  availableQuantity: number;
  categories: ProductDetailCategory[];
  images: ProductDetailImage[];
  variants: ProductDetailVariant[];
}
