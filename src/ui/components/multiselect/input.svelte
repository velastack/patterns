<script lang="ts" generics="T extends string">
	import type { SuperForm } from 'sveltekit-superforms';
	import { getContext, type Snippet } from 'svelte';

	const { form, type } = getContext<{ form: SuperForm<any, any>; type: 'single' | 'multiple' }>(
		'multiselect-field'
	);
	const { form: formData } = form;

	let {
		children,
		placeholder,
		name,
		value = $bindable()
	}: {
		children: Snippet<[{ selected: T[] }]>;
		placeholder?: string;
		name: string;
		value: T[] | T | undefined;
	} = $props();
</script>

{#if value && value.length > 0}
	{@render children?.({ selected: type === 'single' ? [$formData[name]] : $formData[name] })}
	{#if type === 'multiple'}
		{#each value as v}
			<input type="hidden" {name} value={v} />
		{/each}
	{:else}
		<input type="hidden" {name} {value} />
	{/if}
{:else}
	{placeholder}
{/if}
