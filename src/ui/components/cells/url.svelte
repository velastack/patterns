<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		value,
		class: className,
		target = '_blank',
		rel = 'noopener noreferrer',
		...restProps
	}: {
		value: string | undefined;
		target?: string;
		rel?: string;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex items-center', className)} {...restProps}>
	{#if value}
		<a href={value} {target} {rel}>{value}</a>
	{/if}
</div>
