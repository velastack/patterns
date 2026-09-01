import { apiAdapter, createCms } from '@velastack/cms/server';
import { locales } from '$locales/data';

/**
 * The CMS read path, called from the root `+layout.server.ts`.
 *
 * `/api/cms` is where `src/routes/api/cms/[...path]/+server.ts` mounts the
 * backend. It is also the admin bar's default, so the endpoint is named here
 * and nowhere else.
 *
 * The locales are the site's own, from wuchale, so the CMS supports exactly
 * the languages the UI does; the first is the default that a missing
 * translation falls back to.
 */
export const { load: loadCms, generateEntries } = createCms({
	adapter: apiAdapter({ endpoint: '/api/cms' }),
	locales: [...locales]
});
