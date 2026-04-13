<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';

	let {
		value,
		options,
		class: className,
		...restProps
	}: {
		value: string[] | string | undefined;
		options: Record<string, { label: string; value: string }>;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex items-center', className)} {...restProps}>
	{#if value}
		{#if Array.isArray(value)}
			{#each value.slice(0, 2) as item}
				<Badge variant="outline" class="mr-1">
					{options[item].label}
				</Badge>
			{/each}
		{:else}
			{options[value].label}
		{/if}
	{/if}
</div>
