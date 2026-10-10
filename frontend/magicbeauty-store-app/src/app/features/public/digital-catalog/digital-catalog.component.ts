import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { SliderModule } from 'primeng/slider';
import { catchError, of } from 'rxjs';

import { CategoryService } from '../../../core/services/category.service';
import { SearchBoxComponent } from '../../../shared/components/search-box/search-box.component';
import { CategoryMenuItem } from '../../../shared/models/category.model';
import { CatalogProductListItem } from '../../../shared/models/product.model';
import {
  CatalogFilter,
  PriceRange,
  ProductSort,
  collectSubtrees,
  filterCatalog,
  matchesBrands,
  matchesCategories,
  matchesPrice,
  retailPrice
} from '../../../shared/utils/catalog-filters';
import { formatCop } from '../../../shared/utils/currency';
import { ProductsComponent } from '../products/products.component';

/** El rango de precio redondea su tope a este paso. */
const PRICE_STEP = 5000;

/** Marcas visibles antes de "Ver todas". */
const BRAND_LIMIT = 8;

/** Minúsculas sin tildes, para buscar marcas. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Pestaña "Catálogo digital". No duplica la vitrina: le pone delante el buscador
 * y a su izquierda los filtros (categorías, marcas y precio), que se aplican
 * sobre el listado ya cargado. ?categoria= y ?marca= (enlaces del menú, de
 * Beneficios o compartidos) preseleccionan un filtro; la búsqueda viaja en ?q=.
 */
@Component({
  selector: 'app-digital-catalog',
  imports: [NgTemplateOutlet, FormsModule, SliderModule, ProductsComponent, SearchBoxComponent],
  templateUrl: './digital-catalog.component.html',
  styleUrl: './digital-catalog.component.scss'
})
export class DigitalCatalogComponent {
  private readonly products = viewChild(ProductsComponent);

  /** Query params enlazados por withComponentInputBinding. */
  readonly searchQuery = input<string | undefined>(undefined, { alias: 'q' });
  readonly categorySlug = input<string | undefined>(undefined, { alias: 'categoria' });
  readonly brand = input<string | undefined>(undefined, { alias: 'marca' });

  /** Árbol de todas las categorías activas (estén o no en el menú de la tienda). */
  readonly menu = toSignal(
    inject(CategoryService)
      .getCatalogTree()
      .pipe(catchError(() => of([] as CategoryMenuItem[]))),
    { initialValue: [] as CategoryMenuItem[] }
  );

  /** Búsqueda por nombre dentro del árbol de categorías. */
  readonly categoryQuery = signal('');

  /** Ramas abiertas a mano. Al llegar con ?categoria= se abre el camino hasta ella. */
  readonly expandedCategories = linkedSignal<Set<number>>(() => {
    const slug = this.categorySlug();

    return new Set(slug ? (ancestorsOf(this.menu(), slug) ?? []) : []);
  });

  /**
   * Árbol visible: completo o, si hay búsqueda, solo las ramas que llevan a una
   * categoría cuyo nombre coincide (abiertas para verla).
   */
  readonly visibleCategories = computed(() => {
    const query = fold(this.categoryQuery().trim());

    return query ? filterTree(this.menu(), query) : this.menu();
  });

  private readonly subtrees = computed(() => collectSubtrees(this.menu()));

  readonly items = computed<CatalogProductListItem[]>(() => this.products()?.items() ?? []);
  readonly loading = computed(() => this.products()?.loading() ?? true);

  /** Categorías marcadas. Un ?categoria= de la URL la deja marcada al llegar. */
  readonly selectedCategories = linkedSignal<Set<number>>(() => {
    const slug = this.categorySlug();
    const match = slug ? findBySlug(this.menu(), slug) : null;

    return match ? new Set([match.id]) : new Set();
  });

  readonly selectedBrands = linkedSignal<Set<string>>(() => {
    const brand = this.brand();

    return brand ? new Set([brand]) : new Set();
  });

  readonly sort = signal<ProductSort>('name');

  /** Tope del rango: el mayor precio detal del listado, redondeado hacia arriba. */
  readonly priceBounds = computed<PriceRange>(() => {
    const prices = this.items()
      .map(retailPrice)
      .filter((price): price is number => price !== null);
    const max = prices.length === 0 ? 0 : Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP;

    return { min: 0, max };
  });

  /** Rango elegido; vuelve al completo cuando cambia el listado (otra búsqueda). */
  readonly priceValues = linkedSignal<number[]>(() => [this.priceBounds().min, this.priceBounds().max]);

  readonly priceStep = PRICE_STEP;

  private readonly priceRange = computed<PriceRange | null>(() => {
    const [min, max] = this.priceValues();
    const bounds = this.priceBounds();

    return min <= bounds.min && max >= bounds.max ? null : { min, max };
  });

  private readonly categoryFilter = computed<Set<number> | null>(() => {
    const selected = this.selectedCategories();

    if (selected.size === 0) {
      return null;
    }

    const ids = new Set<number>();

    for (const id of selected) {
      for (const descendant of this.subtrees().get(id) ?? [id]) {
        ids.add(descendant);
      }
    }

    return ids;
  });

  readonly filter = computed<CatalogFilter>(() => ({
    categoryIds: this.categoryFilter(),
    brandNames: this.selectedBrands().size > 0 ? this.selectedBrands() : null,
    priceRange: this.priceRange()
  }));

  readonly resultCount = computed(() => filterCatalog(this.items(), this.filter()).length);

  readonly activeFilterCount = computed(
    () => this.selectedCategories().size + this.selectedBrands().size + (this.priceRange() ? 1 : 0)
  );

  /** Cada categoría cuenta lo que mostraría con los demás filtros vigentes. */
  readonly categoryCounts = computed(() => {
    const base = this.items().filter(
      item => matchesBrands(item, this.filter().brandNames) && matchesPrice(item, this.priceRange())
    );
    const counts = new Map<number, number>();

    for (const [id, subtree] of this.subtrees()) {
      counts.set(id, base.filter(item => matchesCategories(item, subtree)).length);
    }

    return counts;
  });

  /** Marcas del listado actual, con lo que mostraría cada una con los demás filtros. */
  readonly brandOptions = computed(() => {
    const base = this.items().filter(
      item => matchesCategories(item, this.categoryFilter()) && matchesPrice(item, this.priceRange())
    );
    const names = [...new Set(this.items().map(item => item.brandName).filter(name => name))];

    for (const selected of this.selectedBrands()) {
      if (!names.includes(selected)) {
        names.push(selected);
      }
    }

    return names
      .sort((first, second) => first.localeCompare(second, 'es'))
      .map(name => ({ name, count: base.filter(item => item.brandName === name).length }));
  });

  /** Con muchas marcas se muestran las primeras y un buscador; las marcadas siempre se ven. */
  readonly brandLimit = BRAND_LIMIT;
  readonly showAllBrands = signal(false);
  readonly brandQuery = signal('');

  readonly visibleBrands = computed(() => {
    const query = fold(this.brandQuery().trim());
    const options = query ? this.brandOptions().filter(option => fold(option.name).includes(query)) : this.brandOptions();

    if (query || this.showAllBrands()) {
      return options;
    }

    return options.filter((option, index) => index < BRAND_LIMIT || this.selectedBrands().has(option.name));
  });

  /** Panel de filtros en móvil. */
  readonly filtersOpen = signal(false);

  constructor() {
    const document = inject(DOCUMENT);
    effect(onCleanup => {
      if (!this.filtersOpen()) return;
      const elements = [document.documentElement, document.body];
      const previous = elements.map(element => ({
        value: element.style.getPropertyValue('overflow'),
        priority: element.style.getPropertyPriority('overflow')
      }));
      elements.forEach(element => element.style.setProperty('overflow', 'hidden'));
      onCleanup(() => elements.forEach((element, index) => {
        const { value, priority } = previous[index];
        if (value) element.style.setProperty('overflow', value, priority);
        else element.style.removeProperty('overflow');
      }));
    });
  }

  toggleCategory(id: number): void {
    this.selectedCategories.update(current => toggle(current, id));
  }

  toggleBrand(name: string): void {
    this.selectedBrands.update(current => toggle(current, name));
  }

  /** Abierta si se abrió a mano, si hay búsqueda o si contiene una categoría marcada por debajo. */
  isExpanded(node: CategoryMenuItem): boolean {
    if (this.categoryQuery().trim() || this.expandedCategories().has(node.id)) {
      return true;
    }

    const subtree = this.subtrees().get(node.id);

    return [...this.selectedCategories()].some(id => id !== node.id && subtree?.has(id));
  }

  toggleExpanded(id: number): void {
    this.expandedCategories.update(current => toggle(current, id));
  }

  setSort(value: string): void {
    this.sort.set(value as ProductSort);
  }

  clearFilters(): void {
    this.selectedCategories.set(new Set());
    this.selectedBrands.set(new Set());
    this.priceValues.set([this.priceBounds().min, this.priceBounds().max]);
  }

  money(amount: number): string {
    return formatCop(amount);
  }
}

function toggle<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current);

  if (!next.delete(value)) {
    next.add(value);
  }

  return next;
}

/** Ids de las categorías por encima de la del slug (sin incluirla); null si no existe. */
function ancestorsOf(items: readonly CategoryMenuItem[], slug: string): number[] | null {
  for (const item of items) {
    if (item.slug === slug) {
      return [];
    }

    const below = ancestorsOf(item.children, slug);

    if (below) {
      return [item.id, ...below];
    }
  }

  return null;
}

/** Ramas que contienen una categoría cuyo nombre coincide; una coincidencia conserva todas sus hijas. */
function filterTree(items: readonly CategoryMenuItem[], query: string): CategoryMenuItem[] {
  return items.flatMap(item => {
    if (fold(item.name).includes(query)) {
      return [item];
    }

    const children = filterTree(item.children, query);

    return children.length > 0 ? [{ ...item, children }] : [];
  });
}

function findBySlug(items: readonly CategoryMenuItem[], slug: string): CategoryMenuItem | null {
  for (const item of items) {
    if (item.slug === slug) {
      return item;
    }

    const match = findBySlug(item.children, slug);

    if (match) {
      return match;
    }
  }

  return null;
}
