<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import * as Popover from '$lib/components/ui/popover';

	let {
		children,
		...props
	}: PopoverPrimitive.ContentProps & {
		portalProps?: PopoverPrimitive.PortalProps;
	} = $props();
</script>

<Popover.Content {...props}>
	{@render children?.()}
</Popover.Content>
