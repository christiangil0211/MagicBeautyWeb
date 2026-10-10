import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { CatalogProductListItem } from '../../models/product.model';
import { formatCop } from '../../utils/currency';

/** Letras mínimas antes de sugerir: con una sola casi todo el catálogo coincide. */
const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 6;

interface TextPart {
  text: string;
  match: boolean;
}

interface Suggestion {
  product: CatalogProductListItem;
  nameParts: TextPart[];
  price: string | null;
}

/**
 * Buscador de la tienda con sugerencias mientras se escribe. Busca por nombre,
 * referencia o marca (lo resuelve el API) y se navega con el teclado:
 * flechas para moverse, Enter para abrir y Escape para cerrar.
 */
@Component({
  selector: 'app-search-box',
  templateUrl: './search-box.component.html',
  styleUrl: './search-box.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class SearchBoxComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** Búsqueda vigente (la de la URL) para mostrarla en la caja. */
  readonly value = input('');
  readonly placeholder = input('Busca por nombre, referencia o marca');
  readonly inputId = input('search-box');
  /** Se buscó o se eligió un producto: el panel móvil se cierra con esto. */
  readonly done = output<void>();

  readonly term = signal('');
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly results = signal<CatalogProductListItem[] | null>(null);
  readonly activeIndex = signal(-1);

  readonly suggestions = computed<Suggestion[]>(() =>
    (this.results() ?? []).slice(0, MAX_SUGGESTIONS).map(product => ({
      product,
      nameParts: highlight(product.name, this.term()),
      price: product.prices.length > 0 ? formatCop(product.prices[0].amount) : null
    }))
  );

  readonly total = computed(() => this.results()?.length ?? 0);
  readonly hasTerm = computed(() => this.term().trim().length >= MIN_CHARS);
  readonly showPanel = computed(() => this.open() && this.hasTerm() && (this.loading() || this.results() !== null));
  readonly listId = computed(() => this.inputId() + '-suggestions');

  constructor() {
    // La caja sigue a la URL (p. ej. al volver atrás) sin abrir sugerencias.
    effect(() => this.term.set(this.value()));

    toObservable(this.term)
      .pipe(
        map(term => term.trim()),
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        tap(term => {
          this.activeIndex.set(-1);
          this.loading.set(term.length >= MIN_CHARS);

          if (term.length < MIN_CHARS) {
            this.results.set(null);
          }
        }),
        // switchMap descarta la respuesta de lo que se escribió antes.
        switchMap(term =>
          term.length < MIN_CHARS
            ? of(null)
            : this.catalogService.getProducts({ search: term }).pipe(catchError(() => of([])))
        ),
        takeUntilDestroyed()
      )
      .subscribe(results => {
        if (results !== null) {
          this.results.set(results);
        }

        this.loading.set(false);
      });
  }

  onInput(value: string): void {
    this.term.set(value);
    this.open.set(true);
  }

  onFocus(): void {
    this.open.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;

    switch (event.key) {
      case 'ArrowDown':
        if (count > 0) {
          event.preventDefault();
          this.open.set(true);
          this.activeIndex.update(index => (index + 1) % count);
        }
        break;

      case 'ArrowUp':
        if (count > 0) {
          event.preventDefault();
          this.activeIndex.update(index => (index <= 0 ? count - 1 : index - 1));
        }
        break;

      case 'Escape':
        this.close();
        break;
    }
  }

  /** Enter: abre la sugerencia marcada o, si no hay, busca el texto. */
  submit(event: Event): void {
    event.preventDefault();

    const active = this.suggestions()[this.activeIndex()];

    if (this.showPanel() && active) {
      this.openProduct(active.product);
      return;
    }

    this.searchAll();
  }

  searchAll(): void {
    const term = this.term().trim();

    this.finish();
    this.router.navigate(['/catalogo'], { queryParams: { q: term || null } });
  }

  openProduct(product: CatalogProductListItem): void {
    this.finish();
    this.router.navigate(['/catalogo', product.reference]);
  }

  clear(): void {
    this.term.set('');
    this.results.set(null);
    this.inputRef().nativeElement.focus();
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  private finish(): void {
    this.close();
    this.inputRef().nativeElement.blur();
    this.done.emit();
  }
}

/** Marca en el nombre las partes que coinciden con lo escrito, sin importar tildes. */
function highlight(text: string, term: string): TextPart[] {
  const words = term
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => fold(word));

  if (words.length === 0) {
    return [{ text, match: false }];
  }

  const folded = fold(text);
  const marks = new Array<boolean>(text.length).fill(false);

  for (const word of words) {
    let from = folded.indexOf(word);

    while (from !== -1) {
      marks.fill(true, from, from + word.length);
      from = folded.indexOf(word, from + word.length);
    }
  }

  const parts: TextPart[] = [];

  for (let index = 0; index < text.length; index++) {
    const last = parts[parts.length - 1];

    if (last && last.match === marks[index]) {
      last.text += text[index];
    } else {
      parts.push({ text: text[index], match: marks[index] });
    }
  }

  return parts;
}

/** Minúsculas sin tildes, conservando la longitud para alinear las marcas. */
function fold(value: string): string {
  return Array.from(value, ch => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || ch).join('');
}
