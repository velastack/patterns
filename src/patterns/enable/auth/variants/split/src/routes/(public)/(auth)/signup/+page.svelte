<script lang="ts">
  import { untrack } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import { signupSchema } from "$lib/schemas/signup";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import PocketBase from "pocketbase-sveltekit";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let { data } = $props();
  let authMethods = $derived(data.authMethods);

  const redirect = page.url.searchParams.get("redirect");
  const hasOAuth2 = $derived(
    authMethods.oauth2.enabled && authMethods.oauth2.providers.length > 0,
  );
  const hasAuthMethods = $derived(
    authMethods.password.enabled || authMethods.otp.enabled || hasOAuth2,
  );

  const form = superForm(
    untrack(() => data.form),
    {
      validators: zod4Client(signupSchema),
    },
  );

  const handleOAuth2 = (provider: string) => {
    const pb = new PocketBase("/");

    pb.collection("users")
      .authWithOAuth2({ provider, createData: {} })
      .then(() => goto("/dashboard"));
  };

  const { form: formData } = form;
</script>

<div class="grid h-full lg:grid-cols-2">
  <div class="bg-muted relative hidden lg:block">
    <img
      src="/favicon.svg"
      alt=""
      class="absolute inset-0 m-auto size-32 opacity-20"
    />
  </div>
  <div class="flex flex-col gap-4 p-6 md:p-10">
    <div class="flex justify-center gap-2 md:justify-start">
      <a href="/" class="flex items-center gap-2 font-medium">
        <div
          class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
        >
          <img src="/favicon.svg" alt="logo" class="size-4" />
        </div>
        {data.meta.appName}
      </a>
    </div>
    <div class="flex flex-1 items-center justify-center">
      <div class="w-full max-w-sm">
        <form method="POST">
          <div class="grid gap-6">
            <div class="flex flex-col items-center gap-2 text-center">
              {#if hasAuthMethods}
                <h1 class="text-2xl font-bold">Create an account</h1>
                <p class="text-muted-foreground text-sm text-balance">
                  {hasOAuth2
                    ? "Choose a sign up method"
                    : "Use your email to sign up"}
                </p>
              {:else}
                <h1 class="text-2xl font-bold">Signups are disabled</h1>
                <p class="text-muted-foreground text-sm text-balance">
                  Check back later for signup options
                </p>
              {/if}
            </div>

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
                    class="bg-background text-muted-foreground relative z-10 px-2"
                  >
                    Or continue with
                  </span>
                </div>
              {/if}

              <div class="grid gap-2">
                <Form.Field {form} name="email" class="col-span-1">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label>Email</Form.Label>
                      <Input
                        {...props}
                        type="email"
                        bind:value={$formData.email}
                        required
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors class="contents text-destructive" />
                </Form.Field>

                <Form.Field {form} name="password" class="col-span-1">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label>Password</Form.Label>
                      <Input
                        {...props}
                        type="password"
                        bind:value={$formData.password}
                        required
                        autocomplete="new-password"
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors class="contents text-destructive" />
                </Form.Field>

                <Form.Field {form} name="passwordConfirm" class="col-span-1">
                  <Form.Control>
                    {#snippet children({ props })}
                      <Form.Label>Confirm Password</Form.Label>
                      <Input
                        {...props}
                        type="password"
                        bind:value={$formData.passwordConfirm}
                        required
                        autocomplete="new-password"
                      />
                    {/snippet}
                  </Form.Control>
                  <Form.FieldErrors class="contents text-destructive" />
                </Form.Field>
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
      </div>
    </div>
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
