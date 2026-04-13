<script lang="ts">
	import { goto } from '$app/navigation';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';

	let {
		viewPath,
		editPath,
		deletePath
	}: {
		viewPath: string;
		editPath: string;
		deletePath: string;
	} = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" class="data-[state=open]:bg-muted flex h-8 w-8 p-0">
				<EllipsisIcon />
				<span class="sr-only">Open Menu</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-[160px]" align="end">
		<DropdownMenu.Item onclick={() => goto(viewPath)}>View</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => goto(editPath)}>Edit</DropdownMenu.Item>
		<DropdownMenu.Item>
			<form method="POST" action={deletePath}>
				<button type="submit" class="contents">Delete</button>
			</form>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
