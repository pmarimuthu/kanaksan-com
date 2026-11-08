// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://kanaksan.com',
  trailingSlash: 'never',
  // Pages are static by default. The home page opts out (prerender = false) and is
  // served with ISR: rendered on the server, cached at the edge, refreshed every 5 minutes.
  // That keeps visitor counts and Spotlight start/end dates fresh with no browser JavaScript.
  output: 'static',
  adapter: vercel({
    isr: { expiration: 300 },
  }),
  build: {
    // Inline all CSS into the HTML: no render-blocking stylesheet request.
    inlineStylesheets: 'always',
    format: 'file',
  },
  integrations: [sitemap()],
  compressHTML: true,
});
