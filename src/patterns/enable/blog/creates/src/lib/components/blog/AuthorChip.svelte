<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';
	import type { BlogAuthor } from '$lib/content';

	let {
		author,
		size = 'sm'
	}: { author: BlogAuthor; size?: 'sm' | 'default' | 'lg' } = $props();

	const initials = $derived(
		author.name
			.split(/\s+/)
			.map((part) => part[0])
			.filter(Boolean)
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
</script>

<span class="inline-flex items-center gap-2">
	<Avatar.Root {size}>
		{#if author.avatar}
			<Avatar.Image src={author.avatar} alt={author.name} />
		{/if}
		<Avatar.Fallback class="text-xs">{initials}</Avatar.Fallback>
	</Avatar.Root>
	<span class="text-foreground text-sm font-medium">{author.name}</span>
</span>
