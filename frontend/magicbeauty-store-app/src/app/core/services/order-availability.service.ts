import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { OrderDraftLine } from '../../shared/models/order-draft.model';
import { ProductDetail } from '../../shared/models/product.model';
import { OrderLineAvailability, resolveOrderAvailability } from '../../shared/utils/order-quote';
import { CatalogService } from './catalog.service';

/**
 * Precios y existencias vigentes de las líneas del pedido, siempre desde la API
 * pública del catálogo (la misma que decide qué precios puede ver quien navega).
 * No crea endpoints nuevos: reutiliza el listado y, para tonos, la ficha.
 */
@Injectable({
  providedIn: 'root'
})
export class OrderAvailabilityService {
  private readonly catalogService = inject(CatalogService);

  load(lines: readonly OrderDraftLine[]): Observable<Map<string, OrderLineAvailability>> {
    if (lines.length === 0) {
      return of(new Map());
    }

    const references = [...new Set(lines.filter(line => line.variantId !== null).map(line => line.reference))];

    return this.catalogService.getProducts().pipe(
      switchMap(products => {
        // Solo se piden fichas de productos activos; una ficha que falla es un tono no disponible.
        const activeReferences = references.filter(reference =>
          products.some(product => product.reference === reference)
        );

        const details$ =
          activeReferences.length === 0
            ? of([] as (readonly [string, ProductDetail | null])[])
            : forkJoin(
                activeReferences.map(reference =>
                  this.catalogService.getProductDetail(reference).pipe(
                    map(detail => [reference, detail] as const),
                    catchError(() => of([reference, null] as const))
                  )
                )
              );

        return details$.pipe(
          map(details => resolveOrderAvailability(lines, products, new Map(details)))
        );
      })
    );
  }
}
