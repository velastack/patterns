<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import PocketBase from "pocketbase-sveltekit";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { signupForm } from "./form.remote";

  let { data } = $props();
  let authMethods = $derived(data.authMethods);

  const redirect = page.url.searchParams.get("redirect");
  const hasOAuth2 = $derived(
    authMethods.oauth2.enabled && authMethods.oauth2.providers.length > 0,
  );
  const hasAuthMethods = $derived(
    authMethods.password.enabled || authMethods.otp.enabled || hasOAuth2,
  );

  const handleOAuth2 = (provider: string) => {
    const pb = new PocketBase("/");

    pb.collection("users")
      .authWithOAuth2({ provider, createData: {} })
      .then(() => goto("/dashboard"));
  };
</script>

<div class="h-full flex flex-col items-center justify-center gap-6 p-6 md:p-10">
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
        {#if hasAuthMethods}
          <Card.Header class="text-center">
            <Card.Title class="text-xl">Create an account</Card.Title>
            {#if hasOAuth2}
              <Card.Description>Choose a sign up method</Card.Description>
            {:else}
              <Card.Description>Use your email to sign up</Card.Description>
            {/if}
          </Card.Header>
        {:else}
          <Card.Header class="text-center">
            <Card.Title class="text-xl">Signups are disabled</Card.Title>
            <Card.Description
              >Check back later for signup options</Card.Description
            >
          </Card.Header>
        {/if}
        <Card.Content>
          <form {...signupForm}>
            <div class="grid gap-6">
              {#if hasOAuth2}
                <div class="flex flex-col gap-4">
                  {#each authMethods.oauth2.providers as provider}
                    <Button
                      variant="outline"
                      class="w-full"
                      onclick={() => handleOAuth2(provider.name)}
                    >
                      <img
                        src="/admin/_/images/oauth2/{provider.name}.svg"
                        class="size-5 bg-white p-0.5 rounded-sm"
                        alt=""
                      />
                      Login with {provider.displayName}
                    </Button>
                  {/each}
                </div>
              {/if}

              {#if authMethods.password.enabled}
                {#if hasOAuth2}
                  <div
                    class="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t"
                  >
                    <span
                      class="bg-card text-muted-foreground relative z-10 px-2"
                    >
                      Or continue with
                    </span>
                  </div>
                {/if}

                <div class="grid gap-2">
                  <div class="space-y-2 col-span-1">
                    <label for="email" class="text-sm font-medium">Email</label>
                    <Input
                      id="email"
                      {...signupForm.fields.email.as("text")}
                      type="email"
                      required
                    />
                    {#each signupForm.fields.email.issues() as issue}
                      <p class="text-destructive text-sm">{issue.message}</p>
                    {/each}
                  </div>

                  <div class="space-y-2 col-span-1">
                    <label for="password" class="text-sm font-medium"
                      >Password</label
                    >
                    <Input
                      id="password"
                      {...signupForm.fields.password.as("text")}
                      type="password"
                      required
                      autocomplete="new-password"
                    />
                    {#each signupForm.fields.password.issues() as issue}
                      <p class="text-destructive text-sm">{issue.message}</p>
                    {/each}
                  </div>

                  <div class="space-y-2 col-span-1">
                    <label for="passwordConfirm" class="text-sm font-medium"
                      >Confirm Password</label
                    >
                    <Input
                      id="passwordConfirm"
                      {...signupForm.fields.passwordConfirm.as("text")}
                      type="password"
                      required
                      autocomplete="new-password"
                    />
                    {#each signupForm.fields.passwordConfirm.issues() as issue}
                      <p class="text-destructive text-sm">{issue.message}</p>
                    {/each}
                  </div>

                  {#if signupForm.result?.message}
                    <div class="text-destructive text-sm font-medium -mt-2">
                      {signupForm.result.message}
                    </div>
                  {/if}

                  <Button type="submit" class="w-full">Create account</Button>
                </div>
              {/if}

              <div class="text-center text-sm">
                Already have an account?
                <a
                  href="/login{redirect
                    ? `?redirect=${encodeURIComponent(redirect)}`
                    : ''}"
                  class="underline underline-offset-4"
                >
                  Log in
                </a>
              </div>
            </div>
          </form>
        </Card.Content>
      </Card.Root>
      <div
        class="text-muted-foreground *:[a]:hover:text-primary *:[a]:underline *:[a]:underline-offset-4 text-balance text-center text-xs"
      >
        By clicking continue, you agree to our <a href="/terms"
          >Terms of Service</a
        >
        and <a href="/privacy">Privacy Policy</a>.
      </div>
    </div>
  </div>
</div>
