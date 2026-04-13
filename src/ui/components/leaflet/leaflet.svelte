<script lang="ts">
	import { onMount } from 'svelte';
	import L from 'leaflet';
	import 'leaflet/dist/leaflet.css';

	// manually load the markers so that they can be embedded in the prod bundle
	import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
	import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
	import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

	let { height = 225, point = $bindable(), readonly = false, ...props } = $props();

	let map: L.Map;
	let mapEl: HTMLElement;
	let marker: L.Marker;
	let panTimeoutId: ReturnType<typeof setTimeout>;

	const defaultZoomLevel = 8;

	$effect(() => {
		if (point.lat && point.lon) {
			panInside();
		}
	});

	function normalizeCoordinate(coord: any) {
		return +(+coord).toFixed(6);
	}

	function panInside(debounce = 200) {
		clearTimeout(panTimeoutId);
		panTimeoutId = setTimeout(() => {
			marker?.setLatLng([point.lat, point.lon]);
			map?.panInside([point.lat, point.lon], { padding: [20, 40] });
		}, debounce);
	}

	function initMap() {
		const latlon = [
			normalizeCoordinate(point.lat),
			normalizeCoordinate(point.lon)
		] as L.LatLngTuple;

		map = L.map(mapEl, {
			zoomControl: false,
			maxBounds: [
				[-90, -180],
				[90, 180]
			],
			minZoom: 2
		}).setView(latlon, defaultZoomLevel);

		if (readonly) {
			map.dragging.disable();
			map.touchZoom.disable();
			map.doubleClickZoom.disable();
			map.scrollWheelZoom.disable();
			map.boxZoom.disable();
			map.keyboard.disable();
		}

		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
			noWrap: true
		}).addTo(map);

		map.attributionControl.setPrefix('');

		// reassign the default marker images with the loaded ones
		// (https://leafletjs.com/reference.html#icon-default-option)
		L.Icon.Default.prototype.options.iconUrl = markerIconUrl;
		L.Icon.Default.prototype.options.iconRetinaUrl = markerIconRetinaUrl;
		L.Icon.Default.prototype.options.shadowUrl = markerShadowUrl;
		L.Icon.Default.imagePath = '';

		marker = L.marker(latlon, {
			draggable: true,
			autoPan: true
		}).addTo(map);

		marker.bindTooltip('drag or right click anywhere on the map to move');

		marker.on('moveend', (e) => {
			if (e.sourceTarget?._latlng) {
				select(e.sourceTarget._latlng.lat, e.sourceTarget._latlng.lng, false);
			}
		});

		map.on('contextmenu', (e) => {
			select(e.latlng.lat, e.latlng.lng, false);
		});
	}

	function destroyMap() {
		marker?.remove();
		map?.remove();
	}

	function select(lat: number, lon: number, centerMap = true) {
		point.lat = normalizeCoordinate(lat);
		point.lon = normalizeCoordinate(lon);

		// center the map
		if (centerMap) {
			marker?.setLatLng([point.lat, point.lon]); // optimistic marker update
			map?.panTo([point.lat, point.lon], { animate: false });
		}
	}

	onMount(() => {
		initMap();

		return () => {
			destroyMap();
		};
	});
</script>

<div class="map-wrapper" style="{height ? `height:${height}px` : null};" {...props}>
	<div bind:this={mapEl} class="map-box"></div>
</div>

<style>
	.map-wrapper {
		position: relative;
		display: block;
		height: 100%;
		width: 100%;
	}
	.map-box {
		z-index: 1;
		height: 100%;
		width: 100%;
	}
</style>
