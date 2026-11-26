export interface Category {
  id: number;
  name: string;
  description?: string | null;
  slug: string;
  parentCategoryId?: number | null;
  parentCategoryName?: string | null;
  displayOrder: number;
  isActive: boolean;
  imageUrl?: string | null;
  homeImageUrl?: string | null;
  iconUrl?: string | null;
  showInHome: boolean;
  /** Carrusel de productos de esta categoría (y sus subcategorías) en el inicio. Máximo 5. */
  showAsHomeCarousel: boolean;
  showInNavigation: boolean;
  showInMegaMenu: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTree {
  id: number;
  name: string;
  slug: string;
  parentCategoryId?: number | null;
  displayOrder: number;
  isActive: boolean;
  showInNavigation: boolean;
  showInHome: boolean;
  /** Carrusel de productos de esta categoría (y sus subcategorías) en el inicio. Máximo 5. */
  showAsHomeCarousel: boolean;
  showInMegaMenu: boolean;
  children: CategoryTree[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
  slug: string;
  parentCategoryId?: number | null;
  displayOrder: number;
  isActive: boolean;
  showInHome: boolean;
  /** Carrusel de productos de esta categoría (y sus subcategorías) en el inicio. Máximo 5. */
  showAsHomeCarousel: boolean;
  showInNavigation: boolean;
  showInMegaMenu: boolean;
}

export interface UpdateCategoryRequest extends CreateCategoryRequest {}
/** Nodo del menú público de la tienda. */
export interface CategoryMenuItem {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  children: CategoryMenuItem[];
}

/** Tarjeta de la sección "Compra por categoría". */
export interface CategoryTile {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

/** Carrusel de productos de una categoría en el inicio (máximo 5). */
export interface CategoryCarousel {
  id: number;
  name: string;
  slug: string;
}

/** Máximo de carruseles de categorías en el inicio (el API lo valida igual). */
export const MAX_HOME_CATEGORY_CAROUSELS = 5;
