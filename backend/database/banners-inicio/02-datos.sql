/*
  Banners del inicio. 02: DATOS. Se ejecuta DESPUÉS de publicar el código.

  Carga en dbo.HomeBanners los 4 banners que hoy están fijos en el código
  (frontend: features/public/portal/home-slides.ts), con las mismas imágenes,
  enlaces, zonas clicables y botones. Así el administrador los puede ordenar,
  editar, desactivar o reemplazar desde Admin › Banners del inicio.

  - Las imágenes siguen en la carpeta del sitio (/images/campaigns/…), con sus
    copias de 768 y 1280 px. Al reemplazarlas desde el administrador, las nuevas
    van al almacenamiento; las de la carpeta del sitio nunca se borran.
  - El calendario de Adviento va primero y se muestra hasta el 24 de diciembre.
  - Idempotente: solo inserta si la tabla está vacía.

  Después: ejecuta 02-datos-verificacion.sql.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;
GO

BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.HomeBanners)
BEGIN
    DECLARE @now datetime2 = SYSUTCDATETIME();

    INSERT INTO dbo.HomeBanners
        (Name, Title, AltText, ImageUrl, ImageWidth, ImageHeight, ImageUrl768, ImageUrl1280,
         LinkUrl, LinkLabel, HotspotsJson, MobileCtasJson, NoteHighlight, NoteText,
         StartsOn, EndsOn, SortOrder, IsActive, CreatedAt, UpdatedAt)
    VALUES
    (N'calendarios',
     N'Calendario de Adviento Magic Beauty 2026',
     N'Edición especial 2026: Calendario de Adviento Magic Beauty. Arma el tuyo con nuestros productos y sorprende en esta Navidad. 100% personalizable, se adapta a tu presupuesto, un regalo único. Cotiza el tuyo.',
     N'/images/campaigns/banner-calendario-magic-beauty-2026.jpg', 2172, 724,
     N'/images/campaigns/banner-calendario-magic-beauty-2026-768.webp',
     N'/images/campaigns/banner-calendario-magic-beauty-2026-1280.webp',
     N'/calendarios-de-adviento', N'Cotiza tu Calendario de Adviento Magic Beauty 2026',
     NULL,
     N'[{"label":"Cotiza el tuyo","link":"/calendarios-de-adviento"}]',
     N'Calendario Magic Beauty:', N'arma el tuyo a tu medida y según tu presupuesto.',
     NULL, '2026-12-24', 1, 1, @now, @now),

    (N'catálogos',
     N'Tu belleza, también en grandes cantidades',
     N'Hazte mayorista. Tu belleza, también en grandes cantidades: precios especiales, productos exclusivos y acompañamiento para hacer crecer tu negocio. Precios especiales, productos exclusivos y asesoría personalizada.',
     N'/images/campaigns/banner-catalogo-mayorista.webp', 2172, 724,
     N'/images/campaigns/banner-catalogo-mayorista-768.webp',
     N'/images/campaigns/banner-catalogo-mayorista-1280.webp',
     NULL, NULL,
     N'[{"label":"Ver catálogo digital","link":"/catalogo","left":2.6,"top":80,"width":16.4,"height":11.6},{"label":"Ver catálogo tradicional","link":"/catalogos","left":19.6,"top":80,"width":19.2,"height":11.6}]',
     N'[{"label":"Ver catálogo digital","link":"/catalogo"},{"label":"Ver catálogo tradicional","link":"/catalogos"}]',
     NULL, NULL,
     NULL, NULL, 2, 1, @now, @now),

    (N'la tienda',
     N'Todo para resaltar tu belleza',
     N'Magic Beauty Cosmetics, nuestra tienda: todo para resaltar tu belleza. Cuidado capilar, maquillaje, skincare y más, con las marcas que te encantan.',
     N'/images/campaigns/banner-tienda-magic-beauty.webp', 2172, 724,
     N'/images/campaigns/banner-tienda-magic-beauty-768.webp',
     N'/images/campaigns/banner-tienda-magic-beauty-1280.webp',
     N'/catalogo', N'Explorar productos en el catálogo digital',
     NULL,
     N'[{"label":"Explorar productos","link":"/catalogo"}]',
     NULL, NULL,
     NULL, NULL, 3, 1, @now, @now),

    (N'medios de pago',
     N'Compra fácil y segura',
     N'Medios de pago. Compra fácil y segura: elige el método de pago que más te convenga. Tarjetas débito o crédito (Visa, Mastercard, American Express), transferencias bancarias y efectivo en tienda. Pagos verificados, compra confiable y atención personalizada.',
     N'/images/campaigns/banner-medios-de-pago.webp', 2172, 724,
     N'/images/campaigns/banner-medios-de-pago-768.webp',
     N'/images/campaigns/banner-medios-de-pago-1280.webp',
     NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, 4, 1, @now, @now);
END

COMMIT;
GO
