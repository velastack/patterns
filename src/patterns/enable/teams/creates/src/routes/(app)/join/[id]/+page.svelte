<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let { data } = $props();
</script>

<div class="flex flex-col flex-1 items-center justify-center gap-6 p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<div
				class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
			>
				<img src="/favicon.svg" alt="logo" class="size-4" />
			</div>
			{data.meta.appName}
		</a>

		<div class="flex flex-col gap-6">
			<Card.Root>
				<Card.Header class="text-center">
					<Card.Title class="text-xl"
						>{data.invite.expand?.team.name} invited you to join their team</Card.Title
					>
					<Card.Description>Accept the invite to join the team</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST">
						<div class="grid gap-6">
							<div class="grid gap-2">
								<Button type="submit" class="w-full">Accept Invite</Button>
							</div>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
