<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		value,
		class: className,
		...restProps
	}: { value: any } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex items-center', className)} {...restProps}>
	{#if value !== undefined}
		{JSON.stringify(value)}
	{/if}
</div>
