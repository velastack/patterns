import { cms } from '$lib/server/cms';

// Uploads land in the data directory after the build, so no static handler
// would find them. Media URLs written into content are root-relative
// `/uploads/<file>`, which is what this route serves.
export const prerender = false;
export const GET = cms.serveUpload;
