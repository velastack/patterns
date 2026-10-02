<script lang="ts">
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	let { children, class: className, ...props }: PopoverPrimitive.TriggerProps = $props();
</script>

<Popover.Trigger
	class={cn(buttonVariants({ variant: 'outline' }), className)}
	role="combobox"
	{...props}
>
	{@render children?.()}
	<ChevronDownIcon class="size-4 opacity-50" />
</Popover.Trigger>
