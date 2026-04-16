<script lang="ts">
	import { getContext } from 'svelte';
	import { fileProxy, filesProxy, type SuperForm } from 'sveltekit-superforms';
	import { Input } from '$lib/components/ui/input';

	const ctx = getContext<{ form: SuperForm<any, any>; name: string }>('file-field');
	const { multiple } = getContext<{ multiple: boolean }>('file-field-multiple');

	const files = multiple ? filesProxy(ctx.form, `${ctx.name}+`) : fileProxy(ctx.form, ctx.name);
	const { form: formData, reset } = ctx.form;

	const { ...props } = $props();

	const onchange = () => {
		reset({
			data: $formData
		});
	};
</script>

{#if !multiple}
	{#if $formData[ctx.name]}
		{#if typeof $formData[ctx.name] === 'string'}
			<input type="text" name={ctx.name} value={$formData[ctx.name]} class="hidden" />
		{:else}
			<input type="file" name={ctx.name} files={$files} class="hidden" />
		{/if}
	{:else}
		<input type="text" name={ctx.name} value="" class="hidden" />
	{/if}
{/if}

<Input
	type="file"
	bind:files={$files}
	{multiple}
	{onchange}
	{...props}
	name={multiple ? `${ctx.name}+` : ''}
/>
