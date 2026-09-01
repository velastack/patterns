import { cms } from '$lib/server/cms';

// `fallback` catches every method, including OPTIONS. The backend does its own
// sub-routing off `params.path`, so a new endpoint never touches this file.
export const prerender = false;
export const fallback = cms.handler;
