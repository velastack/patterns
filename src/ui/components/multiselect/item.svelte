<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import { Command as CommandPrimitive } from 'bits-ui';
	import * as Command from '$lib/components/ui/command';
	import CheckIcon from '@lucide/svelte/icons/check';

	let {
		children,
		value,
		label,
		class: className,
		...props
	}: CommandPrimitive.ItemProps & {
		value: string;
		label: string | undefined;
		children?: Snippet;
		class?: string;
	} = $props();

	const { toggleSelected, isSelected } = getContext<{
		toggleSelected: (value: string) => void;
		isSelected: (value: string) => boolean;
	}>('multiselect-field');

	const handleSelect = () => {
		toggleSelected(value);
	};
</script>

<Command.Item
	class={cn('cursor-pointer', className)}
	{...props}
	value={label}
	onSelect={handleSelect}
>
	{label}
	<CheckIcon class={cn('ml-auto', !isSelected(value) && 'text-transparent')} />
</Command.Item>
