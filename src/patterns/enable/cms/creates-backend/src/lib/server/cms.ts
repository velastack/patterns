import { dataPath } from '@velastack/kit/server';
import { createCmsBackend } from '@velastack/cms/backend';

/**
 * The CMS HTTP backend, mounted single-tenant at `/api/cms` by
 * `src/routes/api/cms/[...path]/+server.ts`.
 *
 * Same origin as the site, so there is no CORS to configure and the session
 * cookie is first-party. Editors sign in against the backend's own
 * `cms_editors` table — add one with `vela cms editor add <email>`.
 *
 * `dataPath` reads `VELA_DATA_DIR`, which `vela` sets wherever it runs the
 * app, so the database and uploads live in the data directory that outlives
 * a release rather than inside the build.
 */
export const cms = createCmsBackend({
	dbPath: dataPath('cms.sqlite'),
	uploadDir: dataPath('uploads')
});
