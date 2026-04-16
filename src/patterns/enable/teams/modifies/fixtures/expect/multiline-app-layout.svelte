<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import AppSidebar from '$lib/components/app-sidebar.svelte';

	let { data, children } = $props();
</script>

<div class="min-h-dvh dashboard">
	<Sidebar.Provider>
		<AppSidebar
			user={data.user}
			meta={data.meta} team={data.team} teams={data.teams ?? []}
		/>
		<Sidebar.Inset>
			{@render children?.()}
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>
