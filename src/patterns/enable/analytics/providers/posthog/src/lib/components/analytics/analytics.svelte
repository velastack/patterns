<script lang="ts">
	import { onMount } from 'svelte';
	import posthog from 'posthog-js';
	import { env } from '$env/dynamic/public';

	// PUBLIC_POSTHOG_KEY is the project API key (phc_...). PUBLIC_POSTHOG_HOST
	// is the ingestion host: US cloud by default, https://eu.i.posthog.com for
	// EU projects, or your own instance. Nothing initialises until the key is
	// set.
	const key = env.PUBLIC_POSTHOG_KEY ?? '';
	const host = env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

	// `defaults: '2025-05-24'` captures a pageview on every history change, so
	// SvelteKit's client-side navigations are counted without extra wiring.
	// Import `posthog` elsewhere for custom events: posthog.capture('sign_up').
	onMount(() => {
		if (!key) return;
		posthog.init(key, { api_host: host, defaults: '2025-05-24' });
	});
</script>
