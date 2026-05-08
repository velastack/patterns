<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import PocketBase from "pocketbase-sveltekit";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { loginForm } from "./form.remote";

  let { data } = $props();
  let authMethods = $derived(data.authMethods);

  const redirect = page.url.searchParams.get("redirect");
  const hasOAuth2 = $derived(
    authMethods.oauth2.enabled && authMethods.oauth2.providers.length > 0,
  );
  const hasAuthMethods = $derived(
    authMethods.password.enabled || authMethods.otp.enabled || hasOAuth2,
  );

  const initialType: "password" | "otp" | "oauth2" = $derived(
    authMethods.otp.enabled
      ? "otp"
      : authMethods.password.enabled
        ? "password"
        : "oauth2",
  );
  let mode = $state<"password" | "otp" | "oauth2">("password");
  $effect(() => {
    mode = initialType;
  });

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
            <Card.Title class="text-xl">Welcome back</Card.Title>
            {#if hasOAuth2}
              <Card.Description>Choose a login method</Card.Description>
            {:else}
              <Card.Description>Use your email to login</Card.Description>
            {/if}
          </Card.Header>
        {:else}
          <Card.Header class="text-center">
            <Card.Title class="text-xl">Login is disabled</Card.Title>
            <Card.Description
              >Check back later for login options</Card.Description
            >
          </Card.Header>
        {/if}
        <Card.Content>
          <form {...loginForm}>
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

              {#if authMethods.password.enabled || authMethods.otp.enabled}
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
                      {...loginForm.fields.email.as("text")}
                      type="email"
                      required
                    />
                    {#each loginForm.fields.email.issues() as issue}
                      <p class="text-destructive text-sm">{issue.message}</p>
                    {/each}
                  </div>

                  {#if mode === "password" && authMethods.password.enabled}
                    <div class="space-y-2 col-span-1">
                      <div class="flex justify-between">
                        <label for="password" class="text-sm font-medium"
                          >Password</label
                        >
                        <a
                          href="/reset"
                          class="ml-auto text-sm underline-offset-4 hover:underline"
                          >Forgot your password?</a
                        >
                      </div>
                      <Input
                        id="password"
                        {...loginForm.fields.password.as("text")}
                        type="password"
                        required
                        autocomplete="current-password"
                      />
                      {#each loginForm.fields.password.issues() as issue}
                        <p class="text-destructive text-sm">{issue.message}</p>
                      {/each}
                    </div>

                    {#if loginForm.result?.message}
                      <div class="text-destructive text-sm font-medium -mt-2">
                        {loginForm.result.message}
                      </div>
                    {/if}

                    <Button type="submit" class="w-full">Login</Button>
                    {#if authMethods.otp.enabled}
                      <Button
                        variant="outline"
                        class="w-full"
                        onclick={() => (mode = "otp")}
                        type="button"
                        >Use one-time code instead</Button
                      >
                    {/if}
                  {:else if mode === "otp" && authMethods.otp.enabled}
                    <Button type="submit" class="w-full"
                      >Send one-time code</Button
                    >
                    {#if authMethods.password.enabled}
                      <Button
                        variant="outline"
                        class="w-full"
                        onclick={() => (mode = "password")}
                        type="button"
                        >Continue with password</Button
                      >
                    {/if}
                  {/if}
                </div>

                <input
                  type="hidden"
                  {...loginForm.fields.type.as("text")}
                  value={mode}
                />
              {/if}

              <div class="text-center text-sm">
                Don&apos;t have an account?
                <a
                  href="/signup{redirect
                    ? `?redirect=${encodeURIComponent(redirect)}`
                    : ''}"
                  class="underline underline-offset-4">Sign up</a
                >
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
