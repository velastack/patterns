<script lang="ts">
	import { untrack } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { goto } from '$app/navigation';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { teamRoleSchema } from '$lib/schemas/teamRole';
	import * as Form from '$lib/components/ui/form';
	import * as Select from '$lib/components/ui/select';

	let { data } = $props();

	const roleLabels = {
		owner: {
			label: 'Owner',
			value: 'owner'
		},
		admin: {
			label: 'Admin',
			value: 'admin'
		},
		member: {
			label: 'Member',
			value: 'member'
		}
	} as const;

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(teamRoleSchema)
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
				<Dialog.Title>Change Role</Dialog.Title>
			</Dialog.Header>
			<Form.Field {form} name="role">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Role</Form.Label>
						<Select.Root type="single" {...props} bind:value={$formData.role}>
							<Select.Trigger class="w-full">
								{roleLabels[$formData.role].label}
							</Select.Trigger>
							<Select.Content>
								{#each Object.values(roleLabels) as role}
									<Select.Item value={role.value}>{role.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="contents text-destructive" />
			</Form.Field>
			<Dialog.Footer class="mt-4">
				<Form.Button>Update Role</Form.Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
