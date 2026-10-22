import { PUBLIC_SHOPIFY_STORE_DOMAIN, PUBLIC_SHOPIFY_STOREFRONT_TOKEN } from '$app/env/public';
import {
	createStorefrontApiClient,
	type StorefrontApiClient
} from '@shopify/storefront-api-client';

/** Shopify supports each Storefront API version for a year; move this forward when it nears its end. */
export const SHOPIFY_API_VERSION = '2026-10';

let client: StorefrontApiClient | undefined;

/**
 * The Storefront API client. Built on first use, not on import: it refuses to
 * be created without a token, and a build or prerender with an empty `.env`
 * should still pass, failing only the requests that need Shopify.
 */
export function storefront(): StorefrontApiClient {
	if (!client) {
		if (!PUBLIC_SHOPIFY_STORE_DOMAIN || !PUBLIC_SHOPIFY_STOREFRONT_TOKEN) {
			throw new Error(
				'PUBLIC_SHOPIFY_STORE_DOMAIN and PUBLIC_SHOPIFY_STOREFRONT_TOKEN are not set, so Shopify cannot be called.'
			);
		}
		client = createStorefrontApiClient({
			storeDomain: PUBLIC_SHOPIFY_STORE_DOMAIN,
			apiVersion: SHOPIFY_API_VERSION,
			publicAccessToken: PUBLIC_SHOPIFY_STOREFRONT_TOKEN
		});
	}
	return client;
}
