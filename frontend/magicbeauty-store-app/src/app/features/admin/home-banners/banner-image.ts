/** Mismas reglas que el API (BannerImageRules), para avisar antes de subir. */
export const BANNER_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const BANNER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const BANNER_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const BANNER_MIN_WIDTH = 1600;
export const BANNER_MAX_WIDTH = 4400;
export const BANNER_RATIO = 3;
export const BANNER_RATIO_TOLERANCE = 0.02;
export const BANNER_COPY_WIDTHS = [768, 1280] as const;

/** Mensaje de error si la imagen no sirve; null si sirve. */
export function bannerImageProblem(file: Pick<File, 'type' | 'size'>, width: number, height: number): string | null {
  if (!BANNER_IMAGE_TYPES.includes(file.type)) return 'Usa una imagen JPG, PNG o WebP.';
  if (file.size === 0 || file.size > BANNER_IMAGE_MAX_BYTES) return 'La imagen debe pesar como máximo 3 MB. Expórtala en JPG o WebP con calidad 80 %.';
  if (width < BANNER_MIN_WIDTH || width > BANNER_MAX_WIDTH) {
    return `La imagen mide ${width} × ${height} px. Debe tener entre ${BANNER_MIN_WIDTH} y ${BANNER_MAX_WIDTH} px de ancho (ideal 2172 × 724).`;
  }
  if (Math.abs(width / height - BANNER_RATIO) / BANNER_RATIO > BANNER_RATIO_TOLERANCE) {
    return `La imagen mide ${width} × ${height} px y debe ser 3 veces más ancha que alta (ideal 2172 × 724).`;
  }
  return null;
}

export interface PreparedBannerImage {
  width: number;
  height: number;
  /** Copias WebP livianas; faltan si el navegador no sabe generar WebP. */
  image768?: Blob;
  image1280?: Blob;
}

/**
 * Lee las medidas y genera en el navegador las copias de 768 y 1280 px (WebP al
 * 82 %): el celular descarga ~40 KB en vez de la imagen completa.
 */
export async function prepareBannerImage(file: File): Promise<PreparedBannerImage> {
  const bitmap = await createImageBitmap(file);

  try {
    const prepared: PreparedBannerImage = { width: bitmap.width, height: bitmap.height };

    for (const width of BANNER_COPY_WIDTHS) {
      if (width >= bitmap.width) continue;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((width * bitmap.height) / bitmap.width);
      const context = canvas.getContext('2d');
      if (!context) return prepared;

      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
      // Safari antiguo devuelve PNG: sin copias, la tienda usa la original.
      if (!blob || blob.type !== 'image/webp') return { width: bitmap.width, height: bitmap.height };

      if (width === 768) prepared.image768 = blob;
      else prepared.image1280 = blob;
    }

    return prepared;
  } finally {
    bitmap.close();
  }
}
