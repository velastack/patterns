import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Every environment variable the app reads. SvelteKit exposes only what is
 * declared here, through `$app/env/private` (and `$app/env/public` for
 * `public: true`).
 *
 * Each schema turns a missing value into `''`, so the app builds and starts
 * with an empty `.env`, and a default belongs at the call site as `X || fallback`.
 */
export const variables = defineEnvVars({
	PUBLIC_SHOPIFY_STORE_DOMAIN: {
		public: true,
		schema: (value) => value ?? '',
		description: "The store's `*.myshopify.com` domain the Storefront API is called on."
	},
	PUBLIC_SHOPIFY_STOREFRONT_TOKEN: {
		public: true,
		schema: (value) => value ?? '',
		description: "Public Storefront API access token, from the store's Headless channel."
	}
});
