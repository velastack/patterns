<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import NotificationsBell from '$lib/components/notifications-bell.svelte';

	let { data, children } = $props();
</script>

<div class="dashboard">
	<Sidebar.Provider>
		<Sidebar.Inset>
			<header class="flex h-16 shrink-0 items-center gap-2">
				<div class="flex items-center gap-2 px-4">
					<Sidebar.Trigger class="-ml-1" />
				</div>

				<div class="ml-auto px-4">
					<NotificationsBell />
				</div>
			</header>
			<div class="flex flex-1 flex-col p-4 pt-0">
				{@render children?.()}
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>
