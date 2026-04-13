<script lang="ts">
	import { getContext } from 'svelte';
	import { fileProxy, filesProxy, type SuperForm } from 'sveltekit-superforms';
	import { Input } from '$lib/components/ui/input';

	const { form, name } = getContext<{ form: SuperForm<any, any>; name: string }>('file-field');
	const { multiple } = getContext<{ multiple: boolean }>('file-field-multiple');

	const files = multiple ? filesProxy(form, `${name}+`) : fileProxy(form, name);
	const { form: formData, reset } = form;

	const { ...props } = $props();

	const onchange = () => {
		reset({
			data: $formData
		});
	};
</script>

{#if !multiple}
	{#if $formData[name]}
		{#if typeof $formData[name] === 'string'}
			<input type="text" {name} value={$formData[name]} class="hidden" />
		{:else}
			<input type="file" {name} files={$files} class="hidden" />
		{/if}
	{:else}
		<input type="text" {name} value="" class="hidden" />
	{/if}
{/if}

<Input
	type="file"
	bind:files={$files}
	{multiple}
	{onchange}
	{...props}
	name={multiple ? `${name}+` : ''}
/>
