<script lang="ts">
  import "../app.css";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "#lib/components/ui/sonner/index.js";
  import { Negotiate } from "#lib/negotiate.js";

  let { children } = $props();
</script>

<ModeWatcher />
<Toaster />

{@render children?.()}

<Negotiate />
