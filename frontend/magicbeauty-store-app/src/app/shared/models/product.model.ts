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

/**
 * Contrato de presentación de la tarjeta pública. Es deliberadamente distinto de
 * `ProductListItem`: la tienda no debe recibir conceptos de administración como
 * `isActive` o el desglose de precios comerciales, solo el precio que le aplica.
 */
export interface ProductCardModel {
  id: number;
  reference: string;
  name: string;
  brandName: string;
  price?: number | null;
  mainImageUrl?: string | null;
  inStock: boolean;
  hasVariants: boolean;
  badge?: string | null;
  isFavorite?: boolean;
}

/**
 * Recorta una fila del listado de administración a lo que la tienda puede conocer.
 * Vive aquí para que el Home y la vitrina compartan exactamente la misma regla:
 * cuando exista el endpoint público de catálogo, solo cambia el origen de los datos.
 */
export function toProductCard(product: ProductListItem): ProductCardModel {
  return {
    id: product.id,
    reference: product.reference,
    name: product.name,
    brandName: product.brandName,
    price: product.defaultPrice,
    mainImageUrl: product.mainImageUrl,
    inStock: product.totalQuantity > 0,
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
 * Lo que la tienda recibe de un producto. Nunca incluye el desglose de precios
 * comerciales ni la variante interna: eso solo existe en administración.
 */
export interface ProductDetail {
  id: number;
  reference: string;
  name: string;
  description?: string | null;
  brandName: string;
  price?: number | null;
  hasVariants: boolean;
  availableQuantity: number;
  categories: ProductDetailCategory[];
  images: ProductDetailImage[];
  variants: ProductDetailVariant[];
}
