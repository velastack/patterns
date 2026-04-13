<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		value,
		class: className,
		...restProps
	}: { value: string | undefined } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex items-center', className)} {...restProps}>********</div>
