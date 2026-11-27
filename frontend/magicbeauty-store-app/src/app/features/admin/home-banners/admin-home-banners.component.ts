import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Observable, concatMap, finalize, map, of } from 'rxjs';

import { HomeBannerService } from '../../../core/services/home-banner.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { HomeBanner, HomeBannerHotspot, HomeBannerLink, SaveHomeBannerRequest } from '../../../shared/models/home-banner.model';
import { HomeBannerStore } from '../../public/portal/home-banner-store';
import { HOME_SLIDES, HomeSlide, colombiaDate, slideFromBanner } from '../../public/portal/home-slides';
import { PortalBannerComponent } from '../../public/portal/portal-banner.component';
import { BANNER_IMAGE_ACCEPT, BANNER_IMAGE_MAX_BYTES, BANNER_IMAGE_TYPES, bannerImageProblem, prepareBannerImage } from './banner-image';
import { BANNER_PROMPT_STYLES, BannerPromptMode, buildBannerPrompt, drawBannerGuide } from './banner-prompt';

type LinkMode = 'none' | 'whole' | 'zones';

type LinkForm = FormGroup<{ label: FormControl<string>; link: FormControl<string> }>;
type HotspotForm = FormGroup<{
  label: FormControl<string>;
  link: FormControl<string>;
  left: FormControl<number>;
  top: FormControl<number>;
  width: FormControl<number>;
  height: FormControl<number>;
}>;

interface PendingImage {
  file: File;
  url: string;
  width: number;
  height: number;
  image768?: Blob;
  image1280?: Blob;
}

export interface BannerStatus {
  label: string;
  severity: 'success' | 'info' | 'warn' | 'secondary' | 'danger';
}

export const MAX_HOTSPOTS = 4;
export const MAX_MOBILE_CTAS = 2;

/** Ruta interna, igual que el API: "/" y nunca "//" (otro sitio). */
export const INTERNAL_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~/?#=&%+]*$/;

/** Páginas frecuentes para sugerir en los enlaces. */
export const STORE_PATHS = ['/', '/catalogo', '/catalogos', '/mayoristas', '/marcas', '/calendarios-de-adviento', '/pedido'];

/** Estado del banner hoy, como lo decide el API. */
export function bannerStatus(banner: HomeBanner, today: string): BannerStatus {
  if (!banner.imageUrl) return { label: 'Sin imagen', severity: 'danger' };
  if (!banner.isActive) return { label: 'Inactivo', severity: 'secondary' };
  if (banner.startsOn && today < banner.startsOn) return { label: `Desde el ${shortDate(banner.startsOn)}`, severity: 'info' };
  if (banner.endsOn && today > banner.endsOn) return { label: 'Vencido', severity: 'warn' };
  return { label: banner.endsOn ? `Visible hasta el ${shortDate(banner.endsOn)}` : 'Visible', severity: 'success' };
}

/** "2026-12-24" → "24/12". */
function shortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Admin › Banners del inicio. Lista a la izquierda (se arrastra para ordenar el
 * carrusel), formulario a la derecha y arriba la vista previa del carrusel tal
 * como lo verá la tienda hoy, con los cambios sin guardar del banner en edición.
 */
@Component({
  selector: 'app-admin-home-banners',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    ToggleSwitchModule,
    SelectButtonModule,
    SelectModule,
    DialogModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    PageHeaderComponent,
    LoaderComponent,
    PortalBannerComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-home-banners.component.html',
  styleUrl: './admin-home-banners.component.scss'
})
export class AdminHomeBannersComponent {
  private readonly bannerService = inject(HomeBannerService);
  private readonly bannerStore = inject(HomeBannerStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly imageAccept = BANNER_IMAGE_ACCEPT;
  readonly storePaths = STORE_PATHS;
  readonly maxHotspots = MAX_HOTSPOTS;
  readonly maxMobileCtas = MAX_MOBILE_CTAS;
  readonly today = colombiaDate(new Date());
  readonly previewPage = { title: 'Vista previa' };

  readonly linkModes: { label: string; value: LinkMode }[] = [
    { label: 'Sin enlace', value: 'none' },
    { label: 'Toda la imagen', value: 'whole' },
    { label: 'Zonas sobre botones', value: 'zones' }
  ];

  readonly banners = signal<HomeBanner[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly reordering = signal(false);
  readonly preparingImage = signal(false);
  readonly selectedId = signal<number | null>(null);
  /** El formulario de un banner nuevo está abierto (aún sin Id). */
  readonly creating = signal(false);

  readonly pendingImage = signal<PendingImage | null>(null);

  /** Dibujando una zona clicable sobre la imagen. */
  readonly drawing = signal(false);
  readonly drawRect = signal<{ left: number; top: number; width: number; height: number } | null>(null);
  private drawStart: { x: number; y: number } | null = null;
  private readonly editorFrame = viewChild<ElementRef<HTMLElement>>('editorFrame');

  readonly selectedBanner = computed(() => this.banners().find(banner => banner.id === this.selectedId()));
  readonly editing = computed(() => this.creating() || !!this.selectedBanner());

  readonly visibleCount = computed(() => this.banners().filter(banner => banner.isVisibleToday).length);
  readonly scheduledCount = computed(() => this.banners().filter(banner => banner.isActive && banner.imageUrl && banner.startsOn && banner.startsOn > this.today).length);
  readonly hiddenCount = computed(() => this.banners().length - this.visibleCount());

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    altText: ['', [Validators.required, Validators.maxLength(500)]],
    linkMode: ['none' as LinkMode],
    linkUrl: ['', [Validators.maxLength(300), Validators.pattern(INTERNAL_PATH)]],
    linkLabel: ['', Validators.maxLength(80)],
    hotspots: this.formBuilder.array<HotspotForm>([]),
    mobileCtas: this.formBuilder.array<LinkForm>([]),
    noteHighlight: ['', Validators.maxLength(60)],
    noteText: ['', Validators.maxLength(200)],
    startsOn: [''],
    endsOn: [''],
    isActive: [true]
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue()
  });

  /** Imagen que se ve en el formulario: la elegida sin guardar o la guardada. */
  readonly editorImage = computed(() => {
    const pending = this.pendingImage();
    if (pending) return { url: pending.url, width: pending.width, height: pending.height };
    const banner = this.selectedBanner();
    return banner?.imageUrl ? { url: banner.imageUrl, width: banner.imageWidth, height: banner.imageHeight } : null;
  });

  readonly draftId = computed(() => (this.selectedId() ? `banner-${this.selectedId()}` : 'banner-nuevo'));

  /** El banner en edición, con los cambios sin guardar, como lo pinta el carrusel. */
  readonly draftSlide = computed<HomeSlide | null>(() => {
    const image = this.editorImage();
    if (!this.editing() || !image) return null;

    const value = this.formValue();
    const banner = this.selectedBanner();
    const pending = this.pendingImage();
    const slide = slideFromBanner({
      id: banner?.id ?? 0,
      name: value.name || 'nuevo banner',
      title: value.title || 'Título del banner',
      altText: value.altText,
      imageUrl: image.url,
      imageWidth: image.width,
      imageHeight: image.height,
      // La imagen nueva aún no tiene copias en el servidor: se muestra la original.
      imageUrl768: pending ? null : (banner?.imageUrl768 ?? null),
      imageUrl1280: pending ? null : (banner?.imageUrl1280 ?? null),
      link: value.linkMode === 'whole' && value.linkUrl ? { label: value.linkLabel || value.title, link: value.linkUrl } : null,
      hotspots: value.linkMode === 'zones' ? value.hotspots : [],
      mobileCtas: value.mobileCtas.filter(cta => cta.label && cta.link),
      noteHighlight: value.noteHighlight || null,
      noteText: value.noteText || null
    });

    return { ...slide, id: this.draftId() };
  });

  /** El banner en edición hoy no se vería en la tienda (se incluye solo para revisarlo). */
  readonly draftHiddenToday = computed(() => {
    const value = this.formValue();
    if (!this.draftSlide()) return false;
    return !value.isActive || (!!value.startsOn && this.today < value.startsOn) || (!!value.endsOn && this.today > value.endsOn);
  });

  /** Carrusel de la tienda hoy, con el borrador en su lugar. Sin ninguno visible, el respaldo. */
  readonly previewSlides = computed<readonly HomeSlide[]>(() => {
    const draft = this.draftSlide();
    const slides: HomeSlide[] = [];

    for (const banner of this.banners()) {
      if (banner.id === this.selectedId() && draft) slides.push(draft);
      else if (banner.isVisibleToday && banner.imageUrl) slides.push(slideFromBanner(banner));
    }

    if (draft && this.creating()) slides.push(draft);

    return slides.length ? slides : HOME_SLIDES;
  });

  readonly usingFallback = computed(() => this.previewSlides() === HOME_SLIDES);

  // ===== Prompt para IA =====
  readonly promptOpen = signal(false);
  readonly promptStyles = [...BANNER_PROMPT_STYLES];
  readonly promptModes: { label: string; value: BannerPromptMode }[] = [
    { label: 'Imagen completa con textos', value: 'full' },
    { label: 'Solo fondo (textos en Canva)', value: 'background' }
  ];
  readonly promptForm = this.formBuilder.nonNullable.group({
    mode: ['full' as BannerPromptMode],
    theme: [''],
    headline: [''],
    subtitle: [''],
    button1: [''],
    button2: [''],
    products: [''],
    style: ['brand'],
    extra: ['']
  });
  private readonly promptValue = toSignal(this.promptForm.valueChanges.pipe(map(() => this.promptForm.getRawValue())), {
    initialValue: this.promptForm.getRawValue()
  });
  readonly prompt = computed(() => {
    const value = this.promptValue();
    return buildBannerPrompt({ ...value, buttons: [value.button1, value.button2] });
  });

  constructor() {
    this.load();

    inject(DestroyRef).onDestroy(() => this.clearPendingImage());
  }

  get hotspots(): FormArray<HotspotForm> {
    return this.form.controls.hotspots;
  }

  get mobileCtas(): FormArray<LinkForm> {
    return this.form.controls.mobileCtas;
  }

  status(banner: HomeBanner): BannerStatus {
    return bannerStatus(banner, this.today);
  }

  load(selectId: number | null = this.selectedId()): void {
    this.loading.set(true);
    this.bannerService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: banners => {
          this.banners.set(banners);
          const selected = banners.find(banner => banner.id === selectId);
          if (selected) this.select(selected);
        },
        error: error => this.showError('No se pudieron cargar los banners', error)
      });
  }

  select(banner: HomeBanner): void {
    this.creating.set(false);
    this.selectedId.set(banner.id);
    this.clearPendingImage();
    this.stopDrawing();

    this.hotspots.clear({ emitEvent: false });
    banner.hotspots.forEach(spot => this.hotspots.push(this.hotspotGroup(spot), { emitEvent: false }));
    this.mobileCtas.clear({ emitEvent: false });
    banner.mobileCtas.forEach(cta => this.mobileCtas.push(this.linkGroup(cta), { emitEvent: false }));

    this.form.reset({
      name: banner.name,
      title: banner.title,
      altText: banner.altText,
      linkMode: banner.hotspots.length ? 'zones' : banner.link ? 'whole' : 'none',
      linkUrl: banner.link?.link ?? '',
      linkLabel: banner.link?.label ?? '',
      noteHighlight: banner.noteHighlight ?? '',
      noteText: banner.noteText ?? '',
      startsOn: banner.startsOn ?? '',
      endsOn: banner.endsOn ?? '',
      isActive: banner.isActive,
      hotspots: banner.hotspots,
      mobileCtas: banner.mobileCtas
    });
  }

  newBanner(): void {
    this.selectedId.set(null);
    this.creating.set(true);
    this.clearPendingImage();
    this.stopDrawing();
    this.hotspots.clear({ emitEvent: false });
    this.mobileCtas.clear({ emitEvent: false });
    this.form.reset({
      name: '',
      title: '',
      altText: '',
      linkMode: 'none',
      linkUrl: '',
      linkLabel: '',
      noteHighlight: '',
      noteText: '',
      startsOn: '',
      endsOn: '',
      isActive: true
    });
  }

  closeEditor(): void {
    this.selectedId.set(null);
    this.creating.set(false);
    this.clearPendingImage();
    this.stopDrawing();
  }

  // ===== Imagen =====

  async selectImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!BANNER_IMAGE_TYPES.includes(file.type)) {
      this.warn('Revisa la imagen', 'Usa una imagen JPG, PNG o WebP.');
      return;
    }

    if (file.size === 0 || file.size > BANNER_IMAGE_MAX_BYTES) {
      this.warn('Revisa la imagen', 'La imagen debe pesar como máximo 3 MB. Expórtala en JPG o WebP con calidad 80 %.');
      return;
    }

    this.preparingImage.set(true);
    try {
      const prepared = await prepareBannerImage(file);
      const problem = bannerImageProblem(file, prepared.width, prepared.height);
      if (problem) {
        this.warn('La imagen no sirve para el carrusel', problem);
        return;
      }

      this.clearPendingImage();
      this.pendingImage.set({ file, url: URL.createObjectURL(file), ...prepared });
    } catch {
      this.warn('Revisa la imagen', 'No se pudo leer la imagen. Expórtala de nuevo como JPG, PNG o WebP.');
    } finally {
      this.preparingImage.set(false);
    }
  }

  private clearPendingImage(): void {
    const pending = this.pendingImage();
    if (pending) URL.revokeObjectURL(pending.url);
    this.pendingImage.set(null);
  }

  // ===== Zonas clicables =====

  private hotspotGroup(spot?: Partial<HomeBannerHotspot>): HotspotForm {
    return this.formBuilder.nonNullable.group({
      label: [spot?.label ?? '', [Validators.required, Validators.maxLength(80)]],
      link: [spot?.link ?? '', [Validators.required, Validators.maxLength(300), Validators.pattern(INTERNAL_PATH)]],
      left: [spot?.left ?? 0, [Validators.required, Validators.min(0), Validators.max(99)]],
      top: [spot?.top ?? 0, [Validators.required, Validators.min(0), Validators.max(99)]],
      width: [spot?.width ?? 10, [Validators.required, Validators.min(1), Validators.max(100)]],
      height: [spot?.height ?? 10, [Validators.required, Validators.min(1), Validators.max(100)]]
    });
  }

  private linkGroup(link?: Partial<HomeBannerLink>): LinkForm {
    return this.formBuilder.nonNullable.group({
      label: [link?.label ?? '', [Validators.required, Validators.maxLength(80)]],
      link: [link?.link ?? '', [Validators.required, Validators.maxLength(300), Validators.pattern(INTERNAL_PATH)]]
    });
  }

  startDrawing(): void {
    if (this.hotspots.length >= MAX_HOTSPOTS) return;
    this.drawing.set(true);
  }

  stopDrawing(): void {
    this.drawing.set(false);
    this.drawRect.set(null);
    this.drawStart = null;
  }

  private pointInFrame(event: PointerEvent): { x: number; y: number } | null {
    const frame = this.editorFrame()?.nativeElement;
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))
    };
  }

  onDrawStart(event: PointerEvent): void {
    if (!this.drawing()) return;
    const point = this.pointInFrame(event);
    if (!point) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.drawStart = point;
    this.drawRect.set({ left: point.x, top: point.y, width: 0, height: 0 });
  }

  onDrawMove(event: PointerEvent): void {
    if (!this.drawStart) return;
    const point = this.pointInFrame(event);
    if (!point) return;
    this.drawRect.set({
      left: Math.min(this.drawStart.x, point.x),
      top: Math.min(this.drawStart.y, point.y),
      width: Math.abs(point.x - this.drawStart.x),
      height: Math.abs(point.y - this.drawStart.y)
    });
  }

  onDrawEnd(): void {
    const rect = this.drawRect();
    if (!this.drawStart || !rect) return;

    if (rect.width >= 1 && rect.height >= 1) {
      this.hotspots.push(
        this.hotspotGroup({ left: round(rect.left), top: round(rect.top), width: round(rect.width), height: round(rect.height) })
      );
      this.messageService.add({ severity: 'info', summary: 'Zona agregada', detail: 'Escribe su texto y a qué página lleva.' });
    }

    this.stopDrawing();
  }

  addHotspot(): void {
    if (this.hotspots.length < MAX_HOTSPOTS) this.hotspots.push(this.hotspotGroup({ left: 3, top: 78, width: 16, height: 12 }));
  }

  removeHotspot(index: number): void {
    this.hotspots.removeAt(index);
  }

  addMobileCta(): void {
    if (this.mobileCtas.length < MAX_MOBILE_CTAS) this.mobileCtas.push(this.linkGroup());
  }

  removeMobileCta(index: number): void {
    this.mobileCtas.removeAt(index);
  }

  /** Los botones de celular repiten los dibujados (o el enlace de toda la imagen). */
  copyLinksToMobile(): void {
    const value = this.form.getRawValue();
    const links: HomeBannerLink[] =
      value.linkMode === 'zones'
        ? value.hotspots.map(spot => ({ label: spot.label, link: spot.link }))
        : value.linkMode === 'whole' && value.linkUrl
          ? [{ label: value.linkLabel || value.title, link: value.linkUrl }]
          : [];

    this.mobileCtas.clear();
    links.slice(0, MAX_MOBILE_CTAS).forEach(link => this.mobileCtas.push(this.linkGroup(link)));
  }

  // ===== Guardar, borrar y ordenar =====

  save(): void {
    if (this.saving()) return;

    const problem = this.formProblem();
    if (problem) {
      this.form.markAllAsTouched();
      this.warn('Revisa el formulario', problem);
      return;
    }

    const value = this.form.getRawValue();
    const request: SaveHomeBannerRequest = {
      name: value.name.trim(),
      title: value.title.trim(),
      altText: value.altText.trim(),
      link: value.linkMode === 'whole' ? { label: value.linkLabel.trim() || value.title.trim(), link: value.linkUrl.trim() } : null,
      hotspots: value.linkMode === 'zones' ? value.hotspots.map(spot => ({ ...spot, label: spot.label.trim(), link: spot.link.trim() })) : [],
      mobileCtas: value.mobileCtas.map(cta => ({ label: cta.label.trim(), link: cta.link.trim() })),
      noteHighlight: value.noteHighlight.trim() || null,
      noteText: value.noteText.trim() || null,
      startsOn: value.startsOn || null,
      endsOn: value.endsOn || null,
      isActive: value.isActive
    };
    const current = this.selectedBanner();
    const pending = this.pendingImage();

    this.saving.set(true);

    const saved$: Observable<HomeBanner> = current
      ? this.bannerService.update(current.id, request)
      : this.bannerService.create(request);

    saved$
      .pipe(
        // La imagen se sube después: un banner nuevo necesita su Id.
        concatMap(banner =>
          pending ? this.bannerService.uploadImage(banner.id, pending.file, { image768: pending.image768, image1280: pending.image1280 }) : of(banner)
        ),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: banner => {
          const detail = banner.isVisibleToday
            ? `"${banner.name}" quedó guardado y ya se ve en la tienda.`
            : `"${banner.name}" quedó guardado. Hoy no se ve en la tienda: ${this.status(banner).label.toLowerCase()}.`;
          this.messageService.add({ severity: 'success', summary: 'Banner guardado', detail });
          this.clearPendingImage();
          this.bannerStore.refresh();
          this.creating.set(false);
          this.load(banner.id);
        },
        error: error => {
          this.showError('No se pudo guardar el banner', error);
          // Si se creó pero falló la imagen, el banner ya existe: se recarga la lista.
          if (!current) this.load(null);
        }
      });
  }

  /** Lo que falta para guardar, en palabras; null si está completo. */
  formProblem(): string | null {
    const controls = this.form.controls;
    const value = this.form.getRawValue();

    if (controls.name.invalid) return 'Escribe un nombre corto (máximo 60 caracteres).';
    if (controls.title.invalid) return 'Escribe el título del banner (máximo 150 caracteres).';
    if (controls.altText.invalid) return 'Escribe el texto alternativo: todo lo que dice la imagen (máximo 500 caracteres).';
    if (!this.editorImage()) return 'Sube la imagen del banner (3:1, ideal 2172 × 724 px).';

    if (value.linkMode === 'whole' && (!value.linkUrl || controls.linkUrl.invalid)) {
      return 'Escribe la página a la que lleva el banner, empezando por «/» (por ejemplo /catalogo).';
    }

    if (value.linkMode === 'zones') {
      if (this.hotspots.length === 0) return 'Dibuja al menos una zona sobre un botón de la imagen, o elige otro tipo de enlace.';
      const index = this.hotspots.controls.findIndex(spot => spot.invalid);
      if (index >= 0) return `Completa la zona ${index + 1}: texto, página (empieza por «/») y medidas dentro de la imagen.`;
      const outside = value.hotspots.findIndex(spot => spot.left + spot.width > 100.5 || spot.top + spot.height > 100.5);
      if (outside >= 0) return `La zona ${outside + 1} se sale de la imagen.`;
    }

    const cta = this.mobileCtas.controls.findIndex(item => item.invalid);
    if (cta >= 0) return `Completa el botón para celular ${cta + 1}: texto y página (empieza por «/»).`;

    if (controls.noteHighlight.invalid || controls.noteText.invalid) return 'El aviso bajo la imagen es demasiado largo.';
    if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) return 'La fecha final no puede ser anterior a la inicial.';

    return null;
  }

  confirmDelete(): void {
    const banner = this.selectedBanner();
    if (!banner) return;

    this.confirmationService.confirm({
      header: 'Eliminar banner',
      message: `¿Eliminar "${banner.name}"? También se borra su imagen. Si solo quieres ocultarlo por un tiempo, desactívalo o ponle fechas.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () =>
        this.bannerService.delete(banner.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Banner eliminado', detail: `"${banner.name}" se eliminó.` });
            this.bannerStore.refresh();
            this.closeEditor();
            this.load(null);
          },
          error: error => this.showError('No se pudo eliminar el banner', error)
        })
    });
  }

  drop(event: CdkDragDrop<HomeBanner[]>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** También con botones: arrastrar no sirve con teclado. */
  move(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.banners().length || this.reordering()) return;

    const previous = this.banners();
    const reordered = [...previous];
    moveItemInArray(reordered, from, to);
    this.banners.set(reordered);
    this.reordering.set(true);

    this.bannerService
      .reorder(reordered.map(banner => banner.id))
      .pipe(finalize(() => this.reordering.set(false)))
      .subscribe({
        next: banners => {
          this.banners.set(banners);
          this.bannerStore.refresh();
          this.messageService.add({ severity: 'success', summary: 'Orden guardado', detail: 'El carrusel ya usa el nuevo orden.' });
        },
        error: error => {
          this.banners.set(previous);
          this.showError('No se pudo guardar el orden', error);
        }
      });
  }

  // ===== Prompt para IA =====

  openPrompt(): void {
    const value = this.form.getRawValue();
    const buttons =
      value.linkMode === 'zones' && value.hotspots.length
        ? value.hotspots.map(spot => spot.label)
        : value.mobileCtas.map(cta => cta.label);

    this.promptForm.patchValue({
      theme: this.promptForm.controls.theme.value || value.name,
      headline: this.promptForm.controls.headline.value || value.title,
      button1: this.promptForm.controls.button1.value || buttons[0] || '',
      button2: this.promptForm.controls.button2.value || buttons[1] || ''
    });
    this.promptOpen.set(true);
  }

  async copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.prompt());
      this.messageService.add({ severity: 'success', summary: 'Prompt copiado', detail: 'Pégalo en ChatGPT, Gemini, Copilot o la IA que uses.' });
    } catch {
      this.warn('No se pudo copiar', 'Selecciona el texto y cópialo con Ctrl + C.');
    }
  }

  /** PNG de 2172 × 724 con las zonas seguras, para diseñar encima o dárselo a la IA. */
  downloadGuide(): void {
    const canvas = document.createElement('canvas');
    drawBannerGuide(canvas);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla-banner-inicio-2172x724.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  private warn(summary: string, detail: string): void {
    this.messageService.add({ severity: 'warn', summary, detail, life: 6000 });
  }

  private showError(summary: string, error: unknown): void {
    const detail =
      error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
        ? error.error.error
        : 'Intenta de nuevo en unos segundos.';
    this.messageService.add({ severity: 'error', summary, detail, life: 6000 });
  }
}
