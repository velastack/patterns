<!--
	The share card: what a link to this site looks like in a chat, a feed or a
	search result. It is rendered to a 1200x630 PNG by `src/lib/server/og.ts`,
	never in a browser, so it is plain markup and CSS and has no interactivity.

	Lay it out with flexbox. Tailwind classes and `app.css` do not apply here;
	only this file's <style> block reaches the renderer.
-->
<svelte:options css="injected" />

<script lang="ts">
	let {
		title,
		description,
		siteName,
		accent = '#4f46e5'
	}: {
		title: string;
		description?: string;
		siteName: string;
		accent?: string;
	} = $props();

	// A long title steps down in size so it stays within three lines.
	const titleSize = $derived(title.length > 70 ? 52 : title.length > 40 ? 64 : 76);
</script>

<div class="card" style:--accent={accent}>
	<div class="bar"></div>
	<div class="body">
		{#if title !== siteName}<div class="site">{siteName}</div>{/if}
		<div class="title" style:font-size="{titleSize}px">{title}</div>
		{#if description}<div class="description">{description}</div>{/if}
	</div>
</div>

<style>
	.card {
		display: flex;
		width: 1200px;
		height: 630px;
		background: linear-gradient(135deg, #0b1020, #1b2140);
		color: white;
	}
	.bar {
		width: 16px;
		background: var(--accent);
	}
	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		gap: 24px;
		padding: 72px;
	}
	.site {
		font-size: 28px;
		opacity: 0.7;
	}
	.title {
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}
	.description {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		font-size: 32px;
		line-height: 1.3;
		opacity: 0.8;
	}
</style>
