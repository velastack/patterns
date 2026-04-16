<script lang="ts">
	import { getContext } from 'svelte';
	import { type SuperForm } from 'sveltekit-superforms';
	import FileIcon from '@lucide/svelte/icons/file';
	import ImageIcon from '@lucide/svelte/icons/image';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	const ctx = getContext<{ form: SuperForm<any, any>; name: string }>('file-field');
	const { form: formData } = ctx.form;

	const {
		file,
		filename,
		collectionId,
		id,
		thumb = '50x50',
		class: className,
		type = 'image',
		...props
	}: {
		file: File | string;
		filename: string;
		collectionId?: string;
		id?: string;
		thumb?: string;
		class?: string;
		type?: 'image' | 'file';
	} & HTMLAttributes<HTMLImageElement> = $props();

	const isImage = $derived(
		type === 'image' ||
			filename.toLowerCase().endsWith('.png') ||
			filename.toLowerCase().endsWith('.jpg') ||
			filename.toLowerCase().endsWith('.jpeg') ||
			filename.toLowerCase().endsWith('.gif') ||
			filename.toLowerCase().endsWith('.webp')
	);

	function getUrl(file: string) {
		return `/api/files/${collectionId ?? $formData.collectionId}/${id ?? $formData.id}/${file}?thumb=${thumb}`;
	}
</script>

{#if typeof file === 'string'}
	{#if (id ?? $formData.collectionId) && (id ?? $formData.id) && isImage}
		<img src={getUrl(file)} alt={filename} class={className} {...props} />
	{:else}
		<div
			class={cn('flex items-center justify-center w-full h-full bg-muted rounded-md', className)}
			{...props as HTMLAttributes<HTMLDivElement>}
		>
			{#if isImage}
				<ImageIcon class="w-4 h-4" />
			{:else}
				<FileIcon class="w-4 h-4" />
			{/if}
		</div>
	{/if}
{:else if isImage}
	<img src={URL.createObjectURL(file)} alt={filename} class={className} {...props} />
{:else}
	<div
		class={cn('flex items-center justify-center w-full h-full bg-muted rounded-md', className)}
		{...props as HTMLAttributes<HTMLDivElement>}
	>
		<FileIcon class="w-4 h-4" />
	</div>
{/if}
