<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
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
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<a href={viewPath} {...props}>View</a>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<a href={editPath} {...props}>Edit</a>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Item>
			<form method="POST" action={deletePath}>
				<button type="submit" class="contents">Delete</button>
			</form>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
