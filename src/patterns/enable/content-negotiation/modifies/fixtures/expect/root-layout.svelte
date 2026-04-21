<script lang="ts">
  import "../app.css";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";
  import { Negotiate } from "$lib/negotiate";

  let { children } = $props();
</script>

<ModeWatcher />
<Toaster />

{@render children?.()}

<Negotiate />
