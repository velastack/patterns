<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let { children, class: className }: { children: Snippet; class?: string } = $props();
</script>

<span class={cn('bg-secondary text-secondary-foreground px-2 py-1 rounded-sm text-sm', className)}>
	{@render children?.()}
</span>
