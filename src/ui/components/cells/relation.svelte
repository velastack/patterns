<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';

	let {
		value,
		expanded,
		displayField = 'id',
		class: className,
		...restProps
	}: {
		value: string[] | string | undefined;
		expanded: any;
		displayField?: string;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex items-center', className)} {...restProps}>
	{#if expanded}
		{#if Array.isArray(expanded)}
			{#each expanded.slice(0, 2) as item}
				<Badge variant="outline" class="mr-1">
					{item[displayField]}
				</Badge>
			{/each}
			{#if expanded.length > 2}
				<Badge variant="secondary" class="mr-1">
					+{expanded.length - 2}
				</Badge>
			{/if}
		{:else}
			<Badge variant="outline" class="mr-1">
				{expanded[displayField]}
			</Badge>
		{/if}
	{/if}
</div>
