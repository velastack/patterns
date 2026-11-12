<script lang="ts">
  import * as Select from "#lib/components/ui/select/index.js";
  import { locales, type Locale } from "#locales/data.js";
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { hasLocalizedUrl, translateUrl } from "#lib/url.js";
  import { localeCookie } from "#lib/locale.js";

  let locale: Locale = $derived(page.data.locale);

  function localeDisplayName(code: Locale): string {
    const names = new Intl.DisplayNames([code], { type: "language" });
    const raw = names.of(code);
    if (!raw) return code;
    return raw.charAt(0).toLocaleUpperCase(code) + raw.slice(1);
  }

  const localeNames: Record<string, string> = locales.reduce(
    (acc, loc) => {
      acc[loc] = localeDisplayName(loc);
      return acc;
    },
    {} as Record<string, string>,
  );

  const handleValueChange = async (value: string) => {
    // Remembered for the pages that have no language in their URL.
    document.cookie = localeCookie(value as Locale);

    if (hasLocalizedUrl(page.url.pathname)) {
      await goto(translateUrl(page.url.pathname, locale, value as Locale), {
        refreshAll: true,
      });
    } else {
      await invalidateAll();
    }
  };

  let { class: className }: { class?: string } = $props();
</script>

<Select.Root type="single" value={locale} onValueChange={handleValueChange}>
  <Select.Trigger class={className}>{localeNames[locale]}</Select.Trigger>
  <Select.Content>
    {#each locales as locale}
      <Select.Item value={locale}>{localeNames[locale]}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
