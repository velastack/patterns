<script lang="ts">
	import { setContext, getContext } from 'svelte';
	import { type SuperForm } from 'sveltekit-superforms';
	import { getName } from './shared';

	const ctx = getContext<{ form: SuperForm<any, any>; name: string }>('file-field');
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

	const { form: formData, reset } = ctx.form;

	setContext('file-field-multiple', { multiple: false });

	const onremove = () => {
		reset({
			data: {
				...$formData,
				[ctx.name]: ''
			}
		});
	};
</script>

{#if $formData[ctx.name]}
	{@render display({ file: $formData[ctx.name], filename: getName($formData[ctx.name]), onremove })}
{/if}

{@render input()}
