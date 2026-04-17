<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { goto } from '$app/navigation';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { teamInviteSchema } from '$lib/schemas/teamInvite';
	import * as Form from '$lib/components/ui/form';

	let { data } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(teamInviteSchema)
		}
	);

	const { form: formData } = form;

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			goto(`/teams/${data.team.id}`, { noScroll: true });
		}
	};
</script>

<Dialog.Root open onOpenChange={handleOpenChange}>
	<Dialog.Content>
		<form method="POST">
			<Dialog.Header class="mb-4">
				<Dialog.Title>Invite to Team</Dialog.Title>
			</Dialog.Header>
			<Form.Field {form} name="email">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Email</Form.Label>
						<Input {...props} type="email" bind:value={$formData.email} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="contents text-destructive" />
			</Form.Field>
			<Dialog.Footer class="mt-4">
				<Form.Button>Send Invite</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
