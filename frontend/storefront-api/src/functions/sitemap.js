const { app } = require('@azure/functions');

const { getSitemapResponse } = require('../sitemap-proxy');

// GET /api/sitemap. staticwebapp.config.json reescribe /sitemap.xml hacia aqui.
app.http('sitemap', {
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous',
  route: 'sitemap',
  handler: async (_request, context) => getSitemapResponse({ log: message => context.warn(message) })
});
