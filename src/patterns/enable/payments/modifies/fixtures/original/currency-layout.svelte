<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Navbar from '#lib/components/ui/navbar/index.js';
	import LanguageSelect from '#lib/components/language-select.svelte';

	let { children }: { children?: Snippet } = $props();
</script>

<Navbar.Root>
	<Navbar.List>
		<Navbar.Item>
			<a href="/">Home</a>
		</Navbar.Item>
		<Navbar.Item>
			<LanguageSelect />
		</Navbar.Item>
	</Navbar.List>
</Navbar.Root>

{@render children?.()}
