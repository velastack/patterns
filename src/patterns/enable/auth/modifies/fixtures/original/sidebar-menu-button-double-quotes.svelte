<script lang="ts">
	import { useSidebar } from "./context.svelte.js";

	let { isActive = false, variant = "default", size = "default", ...restProps } = $props();

	const sidebar = useSidebar();

	const buttonProps = $derived({
		class: "sidebar-menu-button",
		"data-slot": "sidebar-menu-button",
		"data-sidebar": "menu-button",
		"data-size": size,
		"data-active": isActive,
		...restProps
	});
</script>
