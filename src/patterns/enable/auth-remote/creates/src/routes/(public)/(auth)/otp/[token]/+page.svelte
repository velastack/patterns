<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { otpForm } from "./form.remote";

  let { data } = $props();
</script>

<div class="flex flex-col flex-1 items-center justify-center gap-6 p-6 md:p-10">
  <div class="flex w-full max-w-sm flex-col gap-6">
    <a href="/" class="flex items-center gap-2 self-center font-medium">
      <div
        class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
      >
        <img src="/favicon.svg" alt="logo" class="size-4" />
      </div>
      {data.meta.appName}
    </a>

    <div class="flex flex-col gap-6">
      <Card.Root>
        <Card.Header class="text-center">
          <Card.Title class="text-xl">Enter your OTP code</Card.Title>
          <Card.Description
            >Enter the code sent to your email</Card.Description
          >
        </Card.Header>
        <Card.Content>
          <form {...otpForm}>
            <div class="grid gap-6">
              <div class="grid gap-2">
                <div class="space-y-2 col-span-1">
                  <label for="otp" class="text-sm font-medium">OTP code</label>
                  <Input
                    id="otp"
                    {...otpForm.fields.otp.as("text")}
                    type="text"
                    required
                  />
                  {#each otpForm.fields.otp.issues() as issue}
                    <p class="text-destructive text-sm">{issue.message}</p>
                  {/each}
                </div>

                {#if otpForm.result?.message}
                  <div class="text-destructive text-sm font-medium -mt-2">
                    {otpForm.result.message}
                  </div>
                {/if}

                <Button type="submit" class="w-full">Verify code</Button>
              </div>
            </div>
          </form>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
