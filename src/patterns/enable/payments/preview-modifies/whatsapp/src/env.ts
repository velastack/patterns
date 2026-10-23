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
	PUBLIC_WHATSAPP_NUMBER: {
		public: true,
		schema: (value) => value ?? '',
		description:
			"The business's WhatsApp number, with country code, that orders open a chat with."
	},
	PUBLIC_WHATSAPP_ORDER_FORM: {
		public: true,
		schema: (value) => value ?? '',
		description:
			'The hosted VelaStack form each order is recorded to, so it is kept even if the chat is never sent. Empty records nothing.'
	}
});
