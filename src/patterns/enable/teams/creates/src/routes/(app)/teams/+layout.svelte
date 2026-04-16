<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import UserIcon from '@lucide/svelte/icons/user';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import * as Avatar from '$lib/components/ui/avatar';

	const roleLabels = {
		owner: 'Owner',
		admin: 'Admin',
		member: 'Member'
	};

	let { data, children } = $props();
</script>

<section data-slot="content">
	<div class="divide-y divide-border">
		<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
			<div class="px-4 sm:px-0">
				<h2 class="text-base/7 font-semibold text-foreground">Team Management</h2>
				<p class="mt-1 text-sm/6 text-muted-foreground">
					Organize your workspace with teams. Collaborate with members, manage permissions, and
					streamline your workflow.
				</p>
			</div>

			<Card.Root class="md:col-span-2">
				<Card.Header>
					<Card.Title class="text-lg font-semibold">Your Teams</Card.Title>
					<Card.Description>Manage and view your team memberships</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if data.teams && data.teams.length > 0}
						<div class="grid gap-3">
							{#each data.teams as team}
								<div
									class="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
								>
									<div class="flex items-center space-x-3">
										<Avatar.Root class="size-10 rounded-lg">
											<Avatar.Fallback
												class="rounded-lg bg-primary text-primary-foreground font-medium"
											>
												{team.name?.charAt(0).toUpperCase()}
											</Avatar.Fallback>
										</Avatar.Root>
										<div class="flex flex-col">
											{#if team.role === 'owner' || team.role === 'admin'}
												<a
													href="/teams/{team.id}"
													class="font-medium text-foreground hover:text-primary transition-colors"
												>
													{team.name}
												</a>
											{:else}
												<span class="font-medium text-foreground">
													{team.name}
												</span>
											{/if}
											<p class="text-sm text-muted-foreground">
												{team.role ? roleLabels[team.role] : 'Pending'}
											</p>
										</div>
									</div>
									{#if team.type === 'team'}
										<div class="flex items-center space-x-2 text-sm text-muted-foreground">
											<UserIcon class="w-4 h-4" />
											<span class="font-medium">
												{team.members} member{team.members !== 1 ? 's' : ''}
											</span>
										</div>
									{:else if team.type === 'membership'}
										<div class="flex items-center">
											<form method="POST" action="?/leaveTeam">
												<input type="hidden" name="team_id" value={team.id} />
												<Button type="submit" variant="outline" size="sm">
													<LogOutIcon class="w-4 h-4" />
													Leave team
												</Button>
											</form>
										</div>
									{:else if team.type === 'invite'}
										<div class="flex items-center">
											<form method="POST" action="?/acceptInvite">
												<input type="hidden" name="invite_id" value={team.invite_id} />
												<Button type="submit" variant="outline" size="sm">
													<UserPlusIcon class="w-4 h-4" />
													Accept invitation
												</Button>
											</form>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8">
							<div
								class="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4"
							>
								<UserIcon class="w-6 h-6 text-muted-foreground" />
							</div>
							<h3 class="text-lg font-medium text-foreground mb-2">No teams yet</h3>
							<p class="text-muted-foreground mb-4">Get started by creating your first team</p>
						</div>
					{/if}
				</Card.Content>
				<Card.Footer class="flex justify-between items-center pt-4 border-t">
					<div class="text-sm text-muted-foreground">
						{data.teams?.length || 0} team{(data.teams?.length || 0) !== 1 ? 's' : ''}
					</div>
					<Button size="sm" href="/teams/new" class="ml-auto">Create new team</Button>
				</Card.Footer>
			</Card.Root>
		</div>
	</div>
</section>

{@render children?.()}
