<script lang="ts">
	import { PUBLIC_PLAUSIBLE_DOMAIN } from '$app/env/public';

	// PUBLIC_PLAUSIBLE_DOMAIN is the site as registered in Plausible, e.g.
	// `example.com`. Nothing loads until it is set. The script tracks
	// client-side navigations itself, so no SvelteKit wiring is needed.
	// Self-hosting? Point `src` at your instance instead of plausible.io.
	const domain = PUBLIC_PLAUSIBLE_DOMAIN;
</script>

<svelte:head>
	{#if domain}
		<script defer data-domain={domain} src="https://plausible.io/js/script.js"></script>
	{/if}
</svelte:head>
