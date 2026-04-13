<script>
	import { Button } from '$lib/components/ui/button';
	import MapIcon from '@lucide/svelte/icons/map';
	import { getContext } from 'svelte';
	import { cn } from '$lib/utils';

	let { map } = getContext('geopoint');
</script>

<Button
	variant="outline"
	size="icon"
	class={cn('w-10 rounded-none rounded-r-md border-l-0', map.open && 'rounded-b-none')}
	onclick={() => (map.open = !map.open)}
>
	<MapIcon class="w-4 h-4" />
</Button>
