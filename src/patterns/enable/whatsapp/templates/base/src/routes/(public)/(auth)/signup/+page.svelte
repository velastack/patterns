<script lang="ts">
  import favicon from "#lib/assets/favicon.svg";
  import { site } from "#lib/site.js";

  import { untrack } from "svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import * as Card from "#lib/components/ui/card/index.js";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import { signupSchema } from "#lib/schemas/signup.js";
  import * as Form from "#lib/components/ui/form/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import PocketBase from "pocketbase-sveltekit";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let { data } = $props();
  let authMethods = $derived(data.authMethods);
  let whatsappSignup = $derived(data.whatsappSignup);

  const redirect = page.url.searchParams.get("redirect");
  const hasOAuth2 = $derived(
    authMethods.oauth2.enabled && authMethods.oauth2.providers.length > 0,
  );
  const hasEmail = $derived(
    authMethods.password.enabled || authMethods.otp.enabled,
  );
  const hasAuthMethods = $derived(hasEmail || whatsappSignup || hasOAuth2);
  // Where "Continue with email" goes back to from WhatsApp.
  const emailType = $derived(
    authMethods.password.enabled ? "password" : "otp",
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

  const { form: formData, message } = form;
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
        {#if hasAuthMethods}
          <Card.Header class="text-center">
            <Card.Title class="text-xl">Create an account</Card.Title>
            {#if hasOAuth2 || (hasEmail && whatsappSignup)}
              <Card.Description>Choose a sign up method</Card.Description>
            {:else if whatsappSignup}
              <Card.Description
                >Use your WhatsApp number to sign up</Card.Description
              >
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
          <form method="POST">
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
                      Sign up with {provider.displayName}
                    </Button>
                  {/each}
                </div>
              {/if}

              {#if hasEmail || whatsappSignup}
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
                  {#if $formData.type === "whatsapp" && whatsappSignup}
                    <Form.Field {form} name="phone" class="col-span-1">
                      <Form.Control>
                        {#snippet children({ props })}
                          <Form.Label>WhatsApp number</Form.Label>
                          <Input
                            {...props}
                            type="tel"
                            bind:value={$formData.phone}
                            required
                            autocomplete="tel"
                            placeholder="+1 616 555 0123"
                            autofocus
                          />
                        {/snippet}
                      </Form.Control>
                      <Form.FieldErrors class="contents text-destructive" />
                    </Form.Field>

                    {#if $message && $message.type === "error"}
                      <div class="text-destructive text-sm font-medium -mt-2">
                        {$message.text}
                      </div>
                    {/if}

                    <Button type="submit" class="w-full"
                      >Send code on WhatsApp</Button
                    >
                    {#if hasEmail}
                      <Button
                        variant="outline"
                        class="w-full"
                        onclick={() =>
                          ($formData.type = emailType as "whatsapp")}
                        >Continue with email</Button
                      >
                    {/if}
                  {:else if hasEmail && $formData.type !== "whatsapp"}
                    <Form.Field {form} name="email" class="col-span-1">
                      <Form.Control>
                        {#snippet children({ props })}
                          <Form.Label>Email</Form.Label>
                          <Input
                            {...props}
                            type="email"
                            bind:value={$formData.email}
                            required
                            autocomplete="username"
                            autofocus
                          />
                        {/snippet}
                      </Form.Control>
                      <Form.FieldErrors class="contents text-destructive" />
                    </Form.Field>

                    {#if $formData.type === "password" && authMethods.password.enabled}
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
                              minlength={8}
                            />
                          {/snippet}
                        </Form.Control>
                        <Form.FieldErrors class="contents text-destructive" />
                      </Form.Field>

                      <Form.Field
                        {form}
                        name="passwordConfirm"
                        class="col-span-1"
                      >
                        <Form.Control>
                          {#snippet children({ props })}
                            <Form.Label>Confirm Password</Form.Label>
                            <Input
                              {...props}
                              type="password"
                              bind:value={$formData.passwordConfirm}
                              required
                              autocomplete="new-password"
                              minlength={8}
                            />
                          {/snippet}
                        </Form.Control>
                        <Form.FieldErrors class="contents text-destructive" />
                      </Form.Field>
                      <Button type="submit" class="w-full">Create account</Button
                      >
                      {#if authMethods.otp.enabled}
                        <Button
                          variant="outline"
                          class="w-full"
                          onclick={() => ($formData.type = "otp" as "password")}
                          >Use one-time code instead</Button
                        >
                      {/if}
                    {:else if $formData.type === "otp" && authMethods.otp.enabled}
                      {#if $message && $message.type === "error"}
                        <div class="text-destructive text-sm font-medium -mt-2">
                          {$message.text}
                        </div>
                      {/if}

                      <Button type="submit" class="w-full"
                        >Send one-time code</Button
                      >
                      {#if authMethods.password.enabled}
                        <Button
                          variant="outline"
                          class="w-full"
                          onclick={() => ($formData.type = "password" as "otp")}
                          >Continue with password</Button
                        >
                      {/if}
                    {/if}

                    {#if whatsappSignup}
                      <Button
                        variant="outline"
                        class="w-full"
                        onclick={() =>
                          ($formData.type = "whatsapp" as "password")}
                        >Continue with WhatsApp</Button
                      >
                    {/if}
                  {/if}
                </div>

                <input type="hidden" name="type" bind:value={$formData.type} />
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
