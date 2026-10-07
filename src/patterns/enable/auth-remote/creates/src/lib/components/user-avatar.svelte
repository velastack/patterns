<script lang="ts">
  import UserRoundIcon from "@lucide/svelte/icons/user-round";
  import * as Avatar from "#lib/components/ui/avatar/index.js";
  import { displayName, userInitial, type UserIdentity } from "#lib/user.js";

  let {
    user,
    class: className,
    fallbackClass,
  }: {
    /** `avatar` is the file name on the record, when one was uploaded. */
    user: (UserIdentity & { id: string; avatar?: string }) | null | undefined;
    class?: string;
    fallbackClass?: string;
  } = $props();

  const initial = $derived(user ? userInitial(user) : null);
</script>

<Avatar.Root class={className}>
  {#if user?.avatar}
    <Avatar.Image
      src="/api/files/users/{user.id}/{user.avatar}"
      alt={displayName(user)}
    />
  {/if}
  <Avatar.Fallback class={fallbackClass}>
    {#if initial}
      {initial}
    {:else}
      <UserRoundIcon class="size-1/2" />
    {/if}
  </Avatar.Fallback>
</Avatar.Root>
