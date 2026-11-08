import products from '../data/products.json';

/** The hub's own pulse app ID. */
export const HUB_APP_ID = 'kanaksan.com';

/**
 * pulse app IDs counted in the suite-wide visitor numbers:
 * the hub + author site + every released app in products.json (by hostname).
 */
export function pulseAppIds(): string[] {
  const appHosts = products.groups
    .flatMap((g) => g.items)
    .filter((i) => (i.status === 'live' || i.status === 'beta') && i.url)
    .map((i) => new URL(i.url).hostname);
  const author = new URL(products.profiles.author).hostname;
  return [...new Set([HUB_APP_ID, author, ...appHosts])];
}
