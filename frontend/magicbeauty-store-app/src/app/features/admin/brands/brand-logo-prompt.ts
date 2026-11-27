/**
 * Prompt para que una IA (ChatGPT, Gemini, Copilot…) limpie y estandarice el logo
 * de una marca tomado de internet. El formato coincide con lo que acepta el API
 * (PNG, máximo 1 MB) y con cómo lo muestra la tienda (caja horizontal, `contain`).
 */
export const BRAND_LOGO_WIDTH = 2087;
export const BRAND_LOGO_HEIGHT = 754;

export const BRAND_LOGO_PROMPT = `Eres un editor experto en logotipos. Te adjunto una imagen tomada de internet que contiene el logo de una marca de cosméticos. Puede venir en cualquier formato (JPG, PNG, WEBP, captura de pantalla, foto de un producto o de un letrero), con fondo, en baja resolución, pixelada, con marcas de agua o junto a otros elementos.

Tu tarea es entregar ESE MISMO logo, limpio y estandarizado para el sitio web de una tienda.

1. IDENTIFICA EL LOGO
   - Encuentra el logotipo principal de la marca y aíslalo. Descarta todo lo demás: productos, envases, personas, fondos, textos promocionales, precios, botones, marcas de agua, sellos de bancos de imágenes y elementos de la página de donde se tomó.
   - Si la imagen trae varias versiones del logo, usa la principal, a color y horizontal.
   - No dejes fragmentos de otros textos, líneas u objetos cortados en los bordes.

2. FIDELIDAD A LA MARCA (lo más importante)
   - Reproduce el logo EXACTAMENTE como es: mismo texto letra por letra, misma tipografía, mismos colores, mismos íconos o símbolos, mismas proporciones y la misma posición de cada elemento.
   - No lo rediseñes, no lo "mejores", no cambies colores, no agregues ni quites elementos y no inventes partes que no se vean.
   - Si el original está pixelado o borroso, aumenta la nitidez y la resolución sin alterar la forma. Bordes definidos, sin artefactos de compresión.
   - Si está deformado (estirado, inclinado o fotografiado en ángulo), corrige la perspectiva para que se vea de frente, sin cambiar su diseño.

3. FONDO TRANSPARENTE
   - Elimina por completo el fondo: el canal alfa es 100 % transparente fuera del logo.
   - Bordes limpios: sin halo blanco ni de color, sin sombras y sin puntos o manchas semitransparentes alrededor.
   - Sin restos del fondo original: nada de manchas, salpicaduras, texturas, grano ni ruido de color dentro de las letras, entre ellas o a su alrededor. Los colores del logo deben verse sólidos y uniformes.
   - Conserva las partes blancas o de color que pertenecen al logo (por ejemplo, un ícono blanco dentro de un círculo). Solo se elimina el fondo exterior.
   - Si el logo es blanco o muy claro (pensado para fondos oscuros) y la marca tiene una versión a color, usa la versión a color. Si no la tiene, mantén sus colores originales.

4. FORMATO DE SALIDA (estándar de la tienda)
   - PNG de 32 bits (RGBA), alta calidad, sin marcas de agua. El archivo debe pesar menos de 1 MB.
   - Lienzo exacto de ${BRAND_LOGO_WIDTH} × ${BRAND_LOGO_HEIGHT} píxeles, horizontal.
   - Logo centrado y escalado proporcionalmente, sin deformarlo, hasta ocupar casi todo el ancho o el alto disponible, con un margen uniforme de 20 a 30 px. Ninguna parte del logo puede tocar ni salirse del borde.
   - Si el logo es cuadrado o vertical, ajústalo por altura y deja transparente el espacio sobrante a los lados.

Entrega únicamente el archivo PNG final.`;
