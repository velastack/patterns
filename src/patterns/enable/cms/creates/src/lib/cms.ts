import { apiAdapter, createCms } from '@velastack/cms/server';

/**
 * The CMS read path, called from the root `+layout.server.ts`.
 *
 * `/api/cms` is where `src/routes/api/cms/[...path]/+server.ts` mounts the
 * backend. It is also the admin bar's default, so the endpoint is named here
 * and nowhere else.
 *
 * `locales` lists every locale the site supports; the first is the default
 * that a missing translation falls back to.
 */
export const { load: loadCms, generateEntries } = createCms({
	adapter: apiAdapter({ endpoint: '/api/cms' }),
	locales: ['en']
});
