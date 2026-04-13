<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		value = $bindable(),
		id,
		label,
		shortLabel,
		mapOpen
	}: {
		value: number;
		id: string;
		label: string;
		shortLabel: string;
		mapOpen: boolean;
	} = $props();
</script>

<div
	class={cn(
		'border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
		'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
		'pr-0 flex items-center',
		label === 'Latitude' && 'rounded-r-none',
		label === 'Longitude' && 'rounded-none -ml-px',
		mapOpen && 'rounded-b-none'
	)}
>
	<label for={id} class="text-muted-foreground mr-2">
		<span class="hidden md:block">{label}</span>
		<span class="block md:hidden">{shortLabel}</span>
	</label>

	<input
		bind:value
		type="number"
		class="border-none outline-none min-w-0 w-full pr-2"
		{id}
		step="0.000001"
	/>
</div>
