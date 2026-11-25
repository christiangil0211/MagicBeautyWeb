const { app } = require('@azure/functions');

const { getSeoPageResponse } = require('../seo-page');

// GET /api/seo-page. staticwebapp.config.json reescribe /catalogo/* hacia aquí;
// Static Web Apps entrega la URL que pidió el navegador en x-ms-original-url.
app.http('seo-page', {
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous',
  route: 'seo-page',
  handler: async (request, context) => {
    const originalUrl = request.headers.get('x-ms-original-url');

    if (!originalUrl) {
      context.warn('Llamada sin x-ms-original-url: no viene de una reescritura del sitio.');
    }

    const response = await getSeoPageResponse({ originalUrl, log: message => context.warn(message) });

    return request.method === 'HEAD' ? { status: response.status, headers: response.headers } : response;
  }
});
