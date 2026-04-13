<script lang="ts">
	import FileIcon from '@lucide/svelte/icons/file';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		value,
		collectionId,
		id,
		class: className,
		...restProps
	}: {
		value: string[] | string | undefined;
		collectionId: string;
		id: string;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn('flex items-center', className)} {...restProps}>
	{#if value}
		{#if Array.isArray(value)}
			{#each value.slice(0, 2) as filename}
				{#if ['.jpg', '.png', '.jpeg', '.webp', '.gif'].some((ext) => filename.endsWith(ext))}
					<img
						src="/api/files/{collectionId}/{id}/{filename}"
						class="w-8 h-8 rounded-sm object-cover inline-block mr-2"
						alt={filename}
						title={filename}
					/>
				{:else}
					<div
						class="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-sm mr-2"
						title={filename}
					>
						<FileIcon class="w-4 h-4" />
					</div>
				{/if}
			{/each}
			{#if value.length > 2}
				and {value.length - 2} more files
			{/if}
		{:else if ['.jpg', '.png', '.jpeg', '.webp', '.gif'].some((ext) => value.endsWith(ext))}
			<img
				src="/api/files/{collectionId}/{id}/{value}"
				class="w-8 h-8 rounded-sm object-cover"
				alt={value}
				title={value}
			/>
		{:else}
			<div
				class="inline-flex items-center justify-center w-8 h-8 bg-muted rounded-sm"
				title={value}
			>
				<FileIcon class="w-4 h-4" />
			</div>
		{/if}
	{/if}
</div>
