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
  imageUrl?: string | null;
  homeImageUrl?: string | null;
  iconUrl?: string | null;
  showInHome: boolean;
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
