<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import LanguageSelect from '$lib/components/language-select.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
<LanguageSelect />

{@render children()}
