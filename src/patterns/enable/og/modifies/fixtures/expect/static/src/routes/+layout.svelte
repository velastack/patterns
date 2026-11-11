<script lang="ts">
	import '../app.css';

	import favicon from '#lib/assets/favicon.svg';
	import { site } from '#lib/site.js';

	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { MetaTags, deepMerge } from 'svelte-meta-tags';
	import type { LayoutProps } from './$types';
	import { withCard } from '#lib/og/index.js';

	let { data, children }: LayoutProps = $props();

	let metaTags = $derived(withCard(deepMerge(data.baseMetaTags, page.data.pageMetaTags), page.url));
</script>

<svelte:head>
	<title>{site.name}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<MetaTags {...metaTags} />
<ModeWatcher />
<Toaster />

{@render children?.()}
