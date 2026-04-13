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

	const { form: formData, reset } = form;

	setContext('file-field-multiple', { multiple: false });

	const onremove = () => {
		reset({
			data: {
				...$formData,
				[name]: ''
			}
		});
	};
</script>

{#if $formData[name]}
	{@render display({ file: $formData[name], filename: getName($formData[name]), onremove })}
{/if}

{@render input()}
