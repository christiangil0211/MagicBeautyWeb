import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CategoryService } from '../../core/services/category.service';
import { PublicLayoutComponent } from './public-layout.component';

it('opens every nested level on hover and keeps ancestors open', async () => {
  TestBed.configureTestingModule({
    imports: [PublicLayoutComponent],
    providers: [provideRouter([]),
      { provide: AuthService, useValue: {
        canManageStore: signal(false), isAuthenticated: signal(false), session: signal(null), ensureSession: () => of(null)
      } },
      { provide: CategoryService, useValue: { getMenu: () => of([
        { id: 1, slug: 'root', name: 'Root', children: [
          { id: 2, slug: 'child', name: 'Child', children: [
            { id: 3, slug: 'grandchild', name: 'Grandchild', children: [
              { id: 4, slug: 'leaf', name: 'Leaf', children: [] }
            ] }
          ] }
        ] }
      ]) } }
    ]
  });
  const fixture = TestBed.createComponent(PublicLayoutComponent);
  await fixture.whenStable();
  fixture.nativeElement.querySelector('.store-menu__item').dispatchEvent(new Event('mouseenter'));
  fixture.detectChanges();
  const child = fixture.nativeElement.querySelector('.nav-dropdown__branch') as HTMLElement;
  child.dispatchEvent(new Event('mouseenter'));
  fixture.detectChanges();
  const grandchild = child.querySelector('.nav-dropdown__branch') as HTMLElement;
  expect(grandchild).not.toBeNull();
  grandchild.dispatchEvent(new Event('mouseenter'));
  fixture.detectChanges();
  expect(grandchild.textContent).toContain('Leaf');
  expect(fixture.componentInstance.isChildExpanded(2)).toBe(true);
  expect(fixture.componentInstance.isChildExpanded(3)).toBe(true);
  child.dispatchEvent(new Event('mouseleave'));
  fixture.detectChanges();
  expect(child.querySelector('.nav-dropdown__sublist')).toBeNull();
});
