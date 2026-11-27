/**
 * Prompt para crear la imagen de un banner con un agente de IA (ChatGPT, Gemini,
 * Copilot, Midjourney, Canva IA…), con las condiciones que exige el carrusel del
 * inicio: medida 3:1, zonas libres para los controles, textos legibles en celular
 * y la identidad visual de Magic Beauty.
 */

export const BANNER_WIDTH = 2172;
export const BANNER_HEIGHT = 724;

export type BannerPromptMode = 'full' | 'background';

export interface BannerPromptStyle {
  value: string;
  label: string;
  /** Cómo se describe el estilo dentro del prompt. */
  description: string;
}

export const BANNER_PROMPT_STYLES: readonly BannerPromptStyle[] = [
  {
    value: 'brand',
    label: 'Magic Beauty (rosado elegante)',
    description: 'premium, femenino, luminoso y limpio; fondo claro con degradado rosado suave'
  },
  {
    value: 'christmas',
    label: 'Navidad',
    description: 'navideño elegante: fondo rosado suave con detalles dorados, luces cálidas desenfocadas, cintas y moños fucsia; nada de rojo y verde chillones'
  },
  {
    value: 'love',
    label: 'Amor y amistad',
    description: 'romántico y alegre: corazones sutiles, pétalos, tonos fucsia y rosa pastel'
  },
  {
    value: 'mothers',
    label: 'Día de la madre',
    description: 'tierno y sofisticado: flores (peonías, rosas), tonos rosa y nude, luz cálida'
  },
  {
    value: 'sale',
    label: 'Promoción / Black Friday',
    description: 'promocional de alto impacto pero elegante: fondo oscuro tinta (#171717) o vino con acentos fucsia neón y brillos'
  },
  {
    value: 'summer',
    label: 'Verano / vacaciones',
    description: 'fresco y luminoso: luz natural, toques de agua, arena o tropicales, tonos rosa coral'
  },
  {
    value: 'wholesale',
    label: 'Mayoristas / negocio',
    description: 'profesional y confiable: productos ordenados en exhibición, cajas, sensación de abundancia y negocio próspero'
  }
];

export interface BannerPromptOptions {
  mode: BannerPromptMode;
  /** Tema o campaña. */
  theme: string;
  headline: string;
  subtitle: string;
  /** Textos de los botones dibujados (0 a 2). */
  buttons: string[];
  /** Productos o elementos que deben aparecer. */
  products: string;
  style: string;
  /** Indicaciones extra de la persona. */
  extra: string;
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const quote = (text: string) => `"${clean(text).replace(/"/g, '”')}"`;

export function buildBannerPrompt(options: BannerPromptOptions): string {
  const style = BANNER_PROMPT_STYLES.find(item => item.value === options.style) ?? BANNER_PROMPT_STYLES[0];
  const buttons = options.buttons.map(clean).filter(Boolean).slice(0, 2);
  const theme = clean(options.theme) || clean(options.headline) || 'campaña de temporada de la tienda';
  const products = clean(options.products) || 'maquillaje, skincare y cuidado personal (labiales, sombras, sérums, cremas, brochas)';
  const lines: string[] = [];

  lines.push(
    'Crea la imagen de un banner publicitario horizontal para la página de inicio de la tienda online «Magic Beauty Cosmetics», una tienda de maquillaje y cosméticos en Cali, Colombia, que vende al detal y al por mayor.',
    '',
    'FORMATO (obligatorio)',
    `- Tamaño exacto: ${BANNER_WIDTH} × ${BANNER_HEIGHT} píxeles, proporción 3:1 horizontal (tres veces más ancho que alto). Si no puedes ese tamaño exacto, usa la proporción 3:1.`,
    '- Imagen plana a sangre: sin bordes, marcos, esquinas redondeadas, sombras externas ni maquetas de pantalla o celular.',
    '- Entrégala en JPG o PNG de alta calidad.',
    '',
    'TEMA',
    `- Campaña: ${theme}.`,
    `- Productos o elementos que deben verse: ${products}.`,
    `- Estilo: ${style.description}.`,
    '',
    'COMPOSICIÓN',
    options.mode === 'full'
      ? '- Textos alineados a la izquierda, dentro del 45 % izquierdo del banner. Productos o imagen principal en la mitad derecha.'
      : '- Deja el 45 % izquierdo como espacio limpio y despejado (fondo suave, sin objetos) para agregar los textos después. Productos o imagen principal en la mitad derecha.',
    '- Margen de seguridad: nada importante a menos de 90 px de los bordes.',
    '- Deja libre la franja inferior central (unos 700 × 90 px): allí van los controles del carrusel.',
    '- Fondo continuo en los bordes izquierdo y derecho: en pantallas muy anchas se extiende difuminado.'
  );

  if (options.mode === 'full') {
    lines.push(
      '- Se verá también en celulares a unos 390 px de ancho: el titular debe medir al menos 90 px de alto y los demás textos al menos 44 px. Máximo 3 bloques de texto, sin letra pequeña ni textos legales.',
      '',
      'TEXTOS (escríbelos exactamente así, en español, con sus tildes y signos; no agregues ningún otro texto)',
      `- Titular: ${quote(options.headline || theme)}`
    );

    if (clean(options.subtitle)) {
      lines.push(`- Texto secundario: ${quote(options.subtitle)}`);
    }

    if (buttons.length) {
      lines.push(
        `- ${buttons.length === 1 ? 'Botón' : 'Botones'}: ${buttons.map(quote).join(' y ')}. Dibújalos como botones tipo píldora en la parte inferior izquierda, en una sola fila y a la misma altura: el primero fucsia #EC1C79 con texto blanco${buttons.length > 1 ? ', el segundo blanco con borde y texto fucsia' : ''}. Altura de cada botón: unos 80 px.`
      );
    }
  } else {
    lines.push('- NO incluyas ningún texto, letra, número, botón ni logo en la imagen.');
  }

  lines.push(
    '',
    'IDENTIDAD VISUAL',
    '- Paleta: fucsia #EC1C79, fucsia oscuro #CF1467, vino #8A3E5D, rosados suaves #FFF5F9, #FCE4EF y #E4B5CA, tinta #171717 para los textos y blanco.'
  );

  if (options.mode === 'full') {
    lines.push('- Tipografía: titular en serif elegante tipo Playfair Display; textos secundarios y botones en sans serif limpia tipo Inter.');
  }

  lines.push(
    '- Fotografía de producto realista y de alta calidad, iluminación de estudio suave, acabado premium.',
    '- No incluyas logos ni nombres de otras marcas, marcas de agua, personas famosas ni textos inventados en los empaques.'
  );

  if (clean(options.extra)) {
    lines.push('', 'INDICACIONES ADICIONALES', `- ${clean(options.extra)}`);
  }

  return lines.join('\n');
}

/**
 * Plantilla de guía (PNG de 2172 × 724) con las zonas seguras dibujadas, para
 * diseñar en Canva, Photoshop o para mostrársela a la IA como referencia.
 */
export function drawBannerGuide(canvas: HTMLCanvasElement): void {
  canvas.width = BANNER_WIDTH;
  canvas.height = BANNER_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return;

  context.fillStyle = '#fff5f9';
  context.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);

  // Zona de textos (45 % izquierdo).
  context.fillStyle = 'rgba(236, 28, 121, 0.08)';
  context.fillRect(90, 90, BANNER_WIDTH * 0.45 - 90, BANNER_HEIGHT - 180);

  // Margen de seguridad.
  context.setLineDash([18, 12]);
  context.lineWidth = 4;
  context.strokeStyle = '#cf1467';
  context.strokeRect(90, 90, BANNER_WIDTH - 180, BANNER_HEIGHT - 180);

  // Controles del carrusel.
  context.setLineDash([]);
  context.fillStyle = 'rgba(40, 40, 46, 0.35)';
  context.fillRect((BANNER_WIDTH - 700) / 2, BANNER_HEIGHT - 90, 700, 90);

  context.fillStyle = '#8a3e5d';
  context.font = '600 44px Inter, Arial, sans-serif';
  context.fillText('Textos y botones (45 % izquierdo)', 130, 170);
  context.font = '400 34px Inter, Arial, sans-serif';
  context.fillText('Titular ≥ 90 px · textos ≥ 44 px', 130, 230);
  context.fillText('Botones abajo a la izquierda, en una fila', 130, BANNER_HEIGHT - 150);
  context.fillText('Productos / imagen principal', BANNER_WIDTH * 0.6, BANNER_HEIGHT / 2);
  context.fillText('Margen de seguridad: 90 px', BANNER_WIDTH - 560, 70);
  context.fillStyle = '#ffffff';
  context.fillText('Controles del carrusel: dejar libre', (BANNER_WIDTH - 600) / 2, BANNER_HEIGHT - 32);
}
