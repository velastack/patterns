<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { apiKeySchema } from '$lib/schemas/apiKey';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	let { data } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(apiKeySchema)
		}
	);

	const { form: formData } = form;
</script>

<section data-role="content">
	<div class="flex justify-between items-center mb-4">
		<h1 class="text-3xl font-bold tracking-tight">New API key</h1>
		<Button href="/api-keys" variant="outline">
			<ArrowLeftIcon class="w-4 h-4" />
			Back to list
		</Button>
	</div>

	<div class="bg-card rounded-lg shadow-sm border p-4">
		<form method="POST">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Form.Field {form} name="label" class="col-span-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Label</Form.Label>
							<Input {...props} type="text" bind:value={$formData.label} />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors class="contents text-destructive" />
				</Form.Field>
			</div>

			<div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
				<Form.Button>Save</Form.Button>
				<Button href="/api-keys" variant="outline">Cancel</Button>
			</div>
		</form>
	</div>
</section>
