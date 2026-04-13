<script lang="ts">
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		value,
		class: className,
		...restProps
	}: {
		value: { lat: number; lon: number } | undefined;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex items-center space-x-1', className)} {...restProps}>
	{#if value}
		<MapPinIcon class="inline-block w-4 h-4 text-muted-foreground" />
		<span>{value.lat.toFixed(6)}, {value.lon.toFixed(6)}</span>
	{/if}
</div>
