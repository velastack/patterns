<script lang="ts">
  import favicon from "#lib/assets/favicon.svg";
  import { site } from "#lib/site.js";

  import { Button } from "#lib/components/ui/button/index.js";
  import * as Card from "#lib/components/ui/card/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { welcomeForm } from "./form.remote";

  let { data } = $props();
</script>

<div class="h-full flex flex-col items-center justify-center gap-6 p-6 md:p-10">
  <div class="flex w-full max-w-sm flex-col gap-6">
    <a href="/" class="flex items-center gap-2 self-center font-medium">
      <div
        class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
      >
        <img src={favicon} alt="logo" class="size-4" />
      </div>
      {site.name}
    </a>

    <div class="flex flex-col gap-6">
      <Card.Root>
        <Card.Header class="text-center">
          <Card.Title class="text-xl">Welcome!</Card.Title>
          <Card.Description>What should we call you?</Card.Description>
        </Card.Header>
        <Card.Content>
          <form {...welcomeForm}>
            <div class="grid gap-6">
              <div class="grid gap-2">
                <div class="space-y-2 col-span-1">
                  <label for="name" class="text-sm font-medium">Name</label>
                  <Input
                    id="name"
                    {...welcomeForm.fields.name.as("text")}
                    autocomplete="name"
                    required
                    autofocus
                  />
                  {#each welcomeForm.fields.name.issues() as issue}
                    <p class="text-destructive text-sm">{issue.message}</p>
                  {/each}
                </div>

                <Button type="submit" class="w-full">Continue</Button>
                <Button href={data.next} variant="ghost" class="w-full"
                  >Skip for now</Button
                >
              </div>
            </div>
          </form>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
