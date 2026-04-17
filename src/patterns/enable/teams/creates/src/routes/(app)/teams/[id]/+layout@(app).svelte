<script lang="ts">
	import { untrack } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import CrownIcon from '@lucide/svelte/icons/crown';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import MailIcon from '@lucide/svelte/icons/mail';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { getAuthorization } from './authorization';
	import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Form from '$lib/components/ui/form';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { Input } from '$lib/components/ui/input';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { teamSchema } from '$lib/schemas/team';

	let { data, children } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(teamSchema),
			warnings: {
				duplicateId: false
			}
		}
	);

	const { form: formData } = form;

	function getRoleIcon(role: 'owner' | 'admin' | 'member') {
		switch (role) {
			case 'owner':
				return CrownIcon;
			case 'admin':
				return ShieldIcon;
			case 'member':
				return UserCheckIcon;
		}
	}

	function handleCopyLink(inviteStr: string) {
		const link = `${data.meta.appURL}/${inviteStr}`;
		navigator.clipboard.writeText(link);
		toast.success('Link copied to clipboard');
	}
</script>

<section data-slot="content">
	{#if data.role === 'owner'}
		<div class="divide-y divide-border">
			<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
				<div class="px-4 sm:px-0">
					<h2 class="text-base/7 font-semibold text-foreground">Team Settings</h2>
					<p class="mt-1 text-sm/6 text-muted-foreground">
						Update your team name and manage basic team settings.
					</p>
				</div>

				<Card.Root class="md:col-span-2">
					<form method="POST" action="?/updateTeam" class="space-y-4">
						<Card.Header>
							<Card.Title class="text-lg font-semibold">Team Name</Card.Title>
							<Card.Description>Update your team's display name</Card.Description>
						</Card.Header>
						<Card.Content>
							<div class="space-y-2">
								<Form.Field {form} name="name">
									<Form.Control>
										{#snippet children({ props })}
											<Input {...props} type="text" bind:value={$formData.name} required />
										{/snippet}
									</Form.Control>
									<Form.FieldErrors class="contents text-destructive" />
								</Form.Field>
							</div>
						</Card.Content>
						<Card.Footer class="flex justify-end pt-4 border-t">
							<Button type="submit" class="flex items-center" size="sm">Save changes</Button>
						</Card.Footer>
					</form>
				</Card.Root>
			</div>
		</div>
	{/if}

	<div class="divide-y divide-border">
		<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
			<div class="px-4 sm:px-0">
				<h2 class="text-base/7 font-semibold text-foreground">Team Members</h2>
				<p class="mt-1 text-sm/6 text-muted-foreground">
					Manage team members and their roles. Control access permissions and organize your team
					effectively.
				</p>
				<div class="mt-4 space-y-2">
					<div class="flex items-center text-sm text-muted-foreground">
						<div class="w-2 h-2 bg-muted-foreground rounded-full mr-2"></div>
						<span>Owner - Full team control</span>
					</div>
					<div class="flex items-center text-sm text-muted-foreground">
						<div class="w-2 h-2 bg-muted-foreground rounded-full mr-2"></div>
						<span>Admin - Manage members</span>
					</div>
					<div class="flex items-center text-sm text-muted-foreground">
						<div class="w-2 h-2 bg-muted-foreground rounded-full mr-2"></div>
						<span>Member - Team access</span>
					</div>
				</div>
			</div>

			<Card.Root class="md:col-span-2">
				<Card.Header>
					<Card.Title class="text-lg font-semibold">{data.team.name} Members</Card.Title>
					<Card.Description>Manage team members and their roles</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Member</Table.Head>
								<Table.Head>Role</Table.Head>
								<Table.Head></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							<!-- Team Members -->
							{#each data.teamMembers as member}
								{@const { canRemove, canChangeRole } = getAuthorization({
									user: data.user,
									role: data.role,
									member
								})}
								<Table.Row>
									<Table.Cell>
										<div class="flex items-center space-x-3">
											<Avatar.Root class="size-8 rounded-lg">
												<Avatar.Fallback
													class="rounded-lg bg-primary text-primary-foreground font-medium"
												>
													{member.name?.charAt(0).toUpperCase() ||
														member.email.charAt(0).toUpperCase()}
												</Avatar.Fallback>
											</Avatar.Root>
											<div class="flex flex-col">
												<div class="font-medium text-foreground">
													{member.name || member.email}
												</div>
												<div class="text-sm text-muted-foreground">
													{member.email}
												</div>
											</div>
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant="outline" class="flex items-center space-x-1 w-fit">
											{@const Icon = getRoleIcon(member.role)}
											<Icon class="w-3 h-3" />
											<span class="capitalize">{member.role}</span>
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<div class="flex space-x-2 justify-end">
											{#if canChangeRole}
												<Button
													href="/teams/{data.team.id}/member/{member.membership_id}"
													variant="outline"
													size="sm"
													data-sveltekit-noscroll
												>
													Change Role
												</Button>
											{/if}
											{#if canRemove}
												<form method="POST" action="?/removeMember">
													<input type="hidden" name="member_id" value={member.membership_id} />
													<Button type="submit" variant="outline" size="sm">Remove</Button>
												</form>
											{/if}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
				<Card.Footer class="flex justify-between items-center pt-4 border-t">
					<div class="text-sm text-muted-foreground">
						{data.teamMembers?.length || 0} member{(data.teamMembers?.length || 0) !== 1 ? 's' : ''}
						total
					</div>
				</Card.Footer>
			</Card.Root>
		</div>
	</div>

	<div class="divide-y divide-border">
		<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
			<div class="px-4 sm:px-0">
				<h2 class="text-base/7 font-semibold text-foreground">Team Invites</h2>
				<p class="mt-1 text-sm/6 text-muted-foreground">
					Invitations that have been sent but not yet accepted. You can resend or cancel pending
					invites.
				</p>
			</div>

			<Card.Root class="md:col-span-2">
				<Card.Header>
					<Card.Title class="text-lg font-semibold">Invitations</Card.Title>
					<Card.Description>Manage pending team invitations</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if data.pendingInvites && data.pendingInvites.length > 0}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Email</Table.Head>
									<Table.Head>Status</Table.Head>
									<Table.Head></Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.pendingInvites as invite}
									<Table.Row>
										<Table.Cell>
											<div class="flex items-center space-x-3">
												<Avatar.Root class="size-8 rounded-lg">
													<Avatar.Fallback
														class="rounded-lg bg-muted text-muted-foreground font-medium"
													>
														<MailIcon class="w-4 h-4" />
													</Avatar.Fallback>
												</Avatar.Root>
												<div class="flex flex-col">
													<div class="font-medium text-foreground">
														{invite.email}
													</div>
													<div class="text-sm text-muted-foreground">Pending invitation</div>
												</div>
											</div>
										</Table.Cell>
										<Table.Cell>
											<Badge variant="outline" class="flex items-center space-x-1 w-fit">
												<ClockIcon class="w-3 h-3" />
												<span>Pending</span>
											</Badge>
										</Table.Cell>
										<Table.Cell>
											<div class="flex space-x-2 justify-end">
												<Button
													variant="outline"
													size="sm"
													onclick={() => handleCopyLink(`invite/${invite.id}`)}>Copy link</Button
												>
												<form method="POST" action="?/resendInvite">
													<input type="hidden" name="invite_id" value={invite.id} />
													<Button type="submit" variant="outline" size="sm">Resend</Button>
												</form>
												<form method="POST" action="?/cancelInvite">
													<input type="hidden" name="invite_id" value={invite.id} />
													<Button type="submit" variant="outline" size="sm">Cancel</Button>
												</form>
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{:else}
						<div class="text-center py-8">
							<div
								class="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4"
							>
								<MailIcon class="w-6 h-6 text-muted-foreground" />
							</div>
							<h3 class="text-lg font-medium text-foreground mb-2">No pending invites</h3>
							<p class="text-muted-foreground mb-4">
								All invitations have been accepted or there are no pending invites
							</p>
						</div>
					{/if}
				</Card.Content>
				<Card.Footer class="flex justify-between items-center pt-4 border-t">
					<div class="text-sm text-muted-foreground">
						{#if data.inviteLink}
							<div class="text-sm text-muted-foreground">
								{data.meta.appURL}/join/{data.inviteLink.id}
							</div>
						{/if}
					</div>
					<div class="flex items-center space-x-2">
						{#if data.inviteLink}
							<Button
								variant="outline"
								size="sm"
								onclick={() => handleCopyLink(`join/${data.inviteLink.id}`)}
							>
								<CopyIcon class="w-4 h-4" />
								Copy invite link
							</Button>
						{/if}

						<Button
							size="sm"
							href="/teams/{data.team.id}/invite"
							class="ml-auto"
							data-sveltekit-noscroll
						>
							<UserPlusIcon class="w-4 h-4" />
							Invite member
						</Button>
					</div>
				</Card.Footer>
			</Card.Root>
		</div>
	</div>

	{#if data.role === 'owner'}
		<div class="divide-y divide-border">
			<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
				<div class="px-4 sm:px-0">
					<h2 class="text-base/7 font-semibold text-foreground">Danger Zone</h2>
					<p class="mt-1 text-sm/6 text-muted-foreground">
						Permanently delete this team and all associated data. This action cannot be undone.
					</p>
				</div>

				<Card.Root class="md:col-span-2">
					<Card.Header>
						<Card.Title class="text-lg font-semibold">Delete Team</Card.Title>
						<Card.Description>
							Remove this team and all associated data permanently
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div
							class="flex items-center space-x-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20"
						>
							<div class="flex-shrink-0">
								<TrashIcon class="w-5 h-5 text-destructive" />
							</div>
							<div class="flex-1">
								<p class="text-sm font-medium text-destructive">Delete this team</p>
								<p class="text-sm text-muted-foreground">
									This will permanently delete the team, remove all members, and delete all
									associated data.
								</p>
							</div>
						</div>
					</Card.Content>
					<Card.Footer class="flex justify-end pt-4 border-t">
						<AlertDialog.Root>
							<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive', size: 'sm' })}>
								<TrashIcon class="w-4 h-4" />
								Delete team
							</AlertDialog.Trigger>
							<AlertDialog.Content>
								<AlertDialog.Header>
									<AlertDialog.Title>Delete Team</AlertDialog.Title>
									<AlertDialog.Description>
										Are you sure you want to delete "{data.team.name}"? This action cannot be
										undone. This will permanently delete the team, remove all members, and delete
										all associated data.
									</AlertDialog.Description>
								</AlertDialog.Header>
								<AlertDialog.Footer>
									<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
									<form method="POST" action="?/deleteTeam" class="inline">
										<AlertDialog.Action>
											<TrashIcon class="w-4 h-4" />
											Delete team
										</AlertDialog.Action>
									</form>
								</AlertDialog.Footer>
							</AlertDialog.Content>
						</AlertDialog.Root>
					</Card.Footer>
				</Card.Root>
			</div>
		</div>
	{/if}
</section>

{@render children?.()}
