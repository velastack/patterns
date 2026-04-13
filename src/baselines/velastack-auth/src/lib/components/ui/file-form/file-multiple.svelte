<script lang="ts">
	import { setContext, getContext } from 'svelte';
	import { type SuperForm } from 'sveltekit-superforms';
	import { getName } from './shared';

	const { form, name } = getContext<{ form: SuperForm<any, any>; name: string }>('file-field');
	const {
		display,
		input
	}: {
		display: (props: {
			file: File | string;
			filename: string;
			onremove: (file: File | string) => void;
		}) => any;
		input: () => any;
	} = $props();

	setContext('file-field-multiple', { multiple: true });

	const { form: formData, reset } = form;

	let removed = $state<string[]>([]);

	const onremove = (file: File | string) => {
		if (typeof file === 'string') {
			removed.push(file);
		}

		reset({
			data: {
				...$formData,
				[name]: $formData[name].filter((f: File | string) => f !== file) as File[] | undefined
			}
		});
	};

	const initialFiles = $formData[name] || [];
</script>

{#if initialFiles}
	{#each initialFiles as file}
		{#if !removed.includes(file)}
			{@render display({ file, filename: getName(file), onremove })}
		{/if}
	{/each}
{/if}

{#each $formData[`${name}+`] as file}
	{#if file && typeof file !== 'string'}
		{@render display({ file, filename: getName(file), onremove })}
	{/if}
{/each}

{#each removed as removedFile}
	<input type="text" name={`${name}-`} value={removedFile} class="hidden" />
{/each}

{@render input()}
