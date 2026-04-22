<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { apiKeySchema } from '$lib/schemas/apiKey';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(apiKeySchema)
		}
	);

	const { form: formData } = form;

	function onOpenChange(open: boolean) {
		if (!open) {
			form.reset();
			goto('/api-keys');
		}
	}
</script>

<Dialog.Root open={true} {onOpenChange}>
	<Dialog.Content>
		<form method="POST">
			<div class="grid grid-cols-1 gap-4">
				<Form.Field {form} name="label" class="col-span-1">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>API key label</Form.Label>
							<Input {...props} type="text" bind:value={$formData.label} autofocus />
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
	</Dialog.Content>
</Dialog.Root>
