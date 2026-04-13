<script lang="ts">
	import { setContext } from 'svelte';
	import ToggleMap from './toggle-map.svelte';
	import Coordinate from './coordinate.svelte';

	let {
		name,
		value = $bindable()
	}: {
		name: string;
		value: string | undefined;
	} = $props();

	const geopoint = $state(value ? JSON.parse(value) : { lat: 0, lon: 0 });
	const map = $state({ open: false });

	setContext('geopoint', {
		geopoint,
		map
	});

	$effect(() => {
		if (value) {
			const parsed = JSON.parse(value);

			if (typeof parsed === 'object' && parsed !== null && 'lat' in parsed && 'lon' in parsed) {
				geopoint.lat = parsed.lat.toFixed(6);
				geopoint.lon = parsed.lon.toFixed(6);
			}
		}
	});

	const stringValue = $derived(
		JSON.stringify({ lat: parseFloat(geopoint.lat), lon: parseFloat(geopoint.lon) })
	);
</script>

<input type="hidden" {name} value={stringValue} />

<div class="w-full">
	<div class="w-full flex">
		<Coordinate
			id="latitude"
			label="Latitude"
			shortLabel="Lat"
			bind:value={geopoint.lat}
			mapOpen={map.open}
		/>
		<Coordinate
			id="longitude"
			label="Longitude"
			shortLabel="Lon"
			bind:value={geopoint.lon}
			mapOpen={map.open}
		/>
		<ToggleMap />
	</div>

	{#if map.open}
		{#await import('$lib/components/ui/leaflet/leaflet.svelte')}
			<div class="h-[225px] w-full bg-input rounded-b-md"></div>
		{:then { default: Leaflet }}
			<Leaflet height={225} point={geopoint} class="rounded-b-md overflow-hidden" />
		{/await}
	{/if}
</div>
