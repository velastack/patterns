<script lang="ts">
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as Avatar from "$lib/components/ui/avatar";
  import {
    updateProfileForm,
    changeEmailForm,
    changePasswordForm,
    resendVerificationForm,
  } from "./form.remote";

  let { data } = $props();
</script>

<div class="divide-y divide-gray-900/10 dark:divide-white/10">
  <div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
    <div class="px-4 sm:px-0">
      <h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">
        Profile
      </h2>
      <p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
        Your profile information.
      </p>
    </div>

    <form
      {...updateProfileForm}
      enctype="multipart/form-data"
      class="md:col-span-2"
    >
      <Card.Root>
        <Card.Content class="flex flex-col gap-6">
          <div class="flex items-center gap-3 justify-between">
            <div class="flex items-center gap-3">
              <Avatar.Root class="size-16">
                <Avatar.Fallback>
                  {data.user.email.charAt(0).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              <div>
                <span class="text-sm font-medium leading-none">Avatar</span>
                <p class="text-muted-foreground text-sm">
                  Upload a new avatar for your profile.
                </p>
              </div>
            </div>
            <label class={buttonVariants({ variant: "outline" })}>
              Upload new picture
              <input
                {...updateProfileForm.fields.avatar.as("file")}
                type="file"
                class="hidden"
              />
            </label>
          </div>
          {#each updateProfileForm.fields.avatar.issues() as issue}
            <p class="text-destructive text-sm">{issue.message}</p>
          {/each}

          <div class="grid gap-6">
            <div class="grid gap-3">
              <label for="name" class="text-sm font-medium">Name</label>
              <Input
                id="name"
                {...updateProfileForm.fields.name.as("text")}
                type="text"
              />
              {#each updateProfileForm.fields.name.issues() as issue}
                <p class="text-destructive text-sm">{issue.message}</p>
              {/each}
            </div>
          </div>
          <div class="grid gap-6">
            <div class="grid gap-3">
              <div class="flex items-start gap-2">
                <Checkbox
                  {...updateProfileForm.fields.emailVisibility.as("checkbox")}
                />
                <div class="grid gap-2">
                  <label
                    for="emailVisibility"
                    class="text-sm font-medium leading-none"
                    >Display email publicly</label
                  >
                  <p class="text-muted-foreground text-sm">
                    By clicking this checkbox, your email will be displayed
                    publicly.
                  </p>
                </div>
              </div>
              {#each updateProfileForm.fields.emailVisibility.issues() as issue}
                <p class="text-destructive text-sm">{issue.message}</p>
              {/each}
            </div>
          </div>
        </Card.Content>
        <Card.Footer class="border-t justify-end">
          <Button type="submit" class="w-fit">Save changes</Button>
        </Card.Footer>
      </Card.Root>
    </form>
  </div>

  <div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
    <div class="px-4 sm:px-0">
      <h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">
        Email
      </h2>
      <p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
        The email address associated with your account.
      </p>
    </div>

    <Card.Root class="md:col-span-2">
      <Card.Content class="flex flex-col gap-6">
        <div class="flex justify-between items-center">
          <span class="text-sm flex items-center gap-2">
            {data.user.email}
            <Badge variant="secondary"
              >{data.user.verified ? "Verified" : "Unverified"}</Badge
            >
          </span>
          <div class="flex items-center gap-3">
            {#if !data.user.verified}
              <form {...resendVerificationForm}>
                <Button type="submit" variant="outline" class="w-fit"
                  >Resend verification email</Button
                >
              </form>
            {/if}

            <Dialog.Root>
              <Dialog.Trigger class={buttonVariants({ variant: "outline" })}>
                Change email
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Change email</Dialog.Title>
                  <Dialog.Description>
                    Enter your new email address. You will receive a
                    verification email.
                  </Dialog.Description>
                </Dialog.Header>
                <form {...changeEmailForm}>
                  <div class="grid gap-6">
                    <div class="grid gap-3">
                      <label for="email" class="text-sm font-medium"
                        >Email</label
                      >
                      <Input
                        id="email"
                        {...changeEmailForm.fields.email.as("text")}
                        type="email"
                        required
                      />
                      {#each changeEmailForm.fields.email.issues() as issue}
                        <p class="text-destructive text-sm">{issue.message}</p>
                      {/each}
                    </div>
                  </div>
                  <Dialog.Footer>
                    <Button type="submit" class="w-fit">Change email</Button>
                  </Dialog.Footer>
                </form>
              </Dialog.Content>
            </Dialog.Root>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
    <div class="px-4 sm:px-0">
      <h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">
        Password
      </h2>
      <p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
        Your password is used to log in to your account.
      </p>
    </div>

    <form {...changePasswordForm} class="md:col-span-2">
      <Card.Root>
        <Card.Content class="flex flex-col gap-6">
          <div class="grid gap-6">
            <div class="grid gap-3">
              <label for="password" class="text-sm font-medium"
                >New password</label
              >
              <Input
                id="password"
                {...changePasswordForm.fields.password.as("text")}
                type="password"
                autocomplete="new-password"
                required
              />
              {#each changePasswordForm.fields.password.issues() as issue}
                <p class="text-destructive text-sm">{issue.message}</p>
              {/each}
            </div>
            <div class="grid gap-3">
              <label for="passwordConfirm" class="text-sm font-medium"
                >Confirm new password</label
              >
              <Input
                id="passwordConfirm"
                {...changePasswordForm.fields.passwordConfirm.as("text")}
                type="password"
                autocomplete="new-password"
                required
              />
              {#each changePasswordForm.fields.passwordConfirm.issues() as issue}
                <p class="text-destructive text-sm">{issue.message}</p>
              {/each}
            </div>
          </div>
        </Card.Content>
        <Card.Footer class="border-t justify-end">
          <Button type="submit" class="w-fit">Update password</Button>
        </Card.Footer>
      </Card.Root>
    </form>
  </div>
</div>
