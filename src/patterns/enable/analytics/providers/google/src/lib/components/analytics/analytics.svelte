<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import { pageView } from './gtag';

	// PUBLIC_GA_MEASUREMENT_ID looks like G-XXXXXXXXXX. Nothing loads until it
	// is set.
	const measurementId = env.PUBLIC_GA_MEASUREMENT_ID ?? '';

	// The tag is configured with send_page_view: false; page views are sent
	// from here instead. afterNavigate runs after the first render and after
	// every client-side navigation, so each route change is counted once.
	afterNavigate(() => pageView(measurementId));
</script>

<svelte:head>
	{#if measurementId}
		<script async src="https://www.googletagmanager.com/gtag/js?id={measurementId}"></script>
	{/if}
</svelte:head>
