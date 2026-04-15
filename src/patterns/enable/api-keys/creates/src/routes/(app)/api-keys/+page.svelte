<script lang="ts">
	import { getFlash } from 'sveltekit-flash-message';
	import { page } from '$app/state';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SquareDashedMousePointerIcon from '@lucide/svelte/icons/square-dashed-mouse-pointer';

	const flash = getFlash(page);

	let open = $state(false);
	let message = $state('');
	let title = $state('');
	let apiKey = $state('');

	$effect(() => {
		if (!$flash) return;

		if ($flash.type === 'success') {
			message = $flash.message;
			title = $flash.title;
			apiKey = $flash.apiKey;
			open = true;
		}

		$flash = undefined;
	});

	async function handleAction() {
		open = false;
		await navigator.clipboard.writeText(apiKey);
	}

	let { data } = $props();
</script>

<section data-role="content">
	<div class="flex justify-between items-center mb-4">
		<h1 class="text-3xl font-bold tracking-tight">API keys</h1>
		<Button href="/api-keys/new" variant="outline">
			<PlusIcon class="w-4 h-4" />
			New API key
		</Button>
	</div>

	<AlertDialog.Root bind:open>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>{title}</AlertDialog.Title>
				<AlertDialog.Description>
					<p>{@html message}</p>
					<Badge variant="outline" class="font-mono my-3 text-base">{apiKey}</Badge>
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Close</AlertDialog.Cancel>
				<AlertDialog.Action onclick={handleAction}>Copy</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<div class="rounded-lg border bg-card overflow-hidden">
		<div class="relative w-full overflow-auto">
			{#if data.apiKeys.length === 0}
				<div class="p-4 text-center text-muted-foreground space-y-4 py-12">
					<SquareDashedMousePointerIcon strokeWidth={1.2} class="w-8 h-8 mx-auto mb-2" />
					<p>Seems like there are no API keys yet, but you can create the first one</p>
					<p class="text-sm text-muted-foreground">
						<Button href="/api-keys/new" variant="outline">
							<PlusIcon class="w-4 h-4" />
							New API key
						</Button>
					</p>
				</div>
			{:else}
				<table class="w-full caption-bottom text-sm">
					<thead>
						<tr class="border-b">
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Label</th
							>
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>API key</th
							>
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Created</th
							>
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Last used</th
							>
							<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.apiKeys as apiKey}
							<tr
								class="border-t transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<td class="p-4 align-middle font-medium">{apiKey.label}</td>

								<td class="p-4 align-middle font-medium">
									<Badge variant="outline" class="font-mono">
										{apiKey.id}.***************
									</Badge>
								</td>

								<td class="p-4 align-middle font-medium">
									{#if apiKey.created}
										{new Date(apiKey.created).toLocaleDateString()}
									{/if}
								</td>

								<td class="p-4 align-middle font-medium">
									{#if apiKey.last_used}
										{new Date(apiKey.last_used).toLocaleDateString()}
									{:else}
										Never
									{/if}
								</td>

								<td class="p-4 align-middle text-right">
									<form method="POST" action="/api-keys/{apiKey.id}?/delete" class="contents">
										<Button
											variant="ghost"
											class="h-8 px-2 text-destructive hover:text-destructive"
											type="submit">Delete</Button
										>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</section>
