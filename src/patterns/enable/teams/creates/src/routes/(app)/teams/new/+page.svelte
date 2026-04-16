<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { goto } from '$app/navigation';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { teamSchema } from '$lib/schemas/team';
	import * as Form from '$lib/components/ui/form';

	let { data } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(teamSchema)
		}
	);

	const { form: formData } = form;

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			goto('/teams', { noScroll: true });
		}
	};
</script>

<Dialog.Root open onOpenChange={handleOpenChange}>
	<Dialog.Content>
		<form method="POST">
			<Dialog.Header class="mb-4">
				<Dialog.Title>Create Team</Dialog.Title>
			</Dialog.Header>
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Team Name</Form.Label>
						<Input {...props} type="text" bind:value={$formData.name} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="contents text-destructive" />
			</Form.Field>
			<Dialog.Footer class="mt-4">
				<Form.Button>Create</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
