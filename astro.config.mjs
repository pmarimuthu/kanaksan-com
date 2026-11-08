// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kanaksan.com',
  trailingSlash: 'never',
  // Phase 1: fully static. Phase 2 adds @astrojs/vercel (ISR + Firebase Spotlight).
  output: 'static',
  build: {
    // Inline all CSS into the HTML: no render-blocking stylesheet request.
    inlineStylesheets: 'always',
    format: 'file',
  },
  integrations: [sitemap()],
  compressHTML: true,
});
