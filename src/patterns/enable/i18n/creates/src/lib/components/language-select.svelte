<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  import { locales, type Locale } from "$locales/data.js";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { deLocalizeDefault } from "wuchale/url";
  import { defaultLocale, translateUrl } from "$lib/url";

  let locale: Locale = $derived.by(() => {
    const [_, locale] = deLocalizeDefault(page.url.pathname, locales);
    return locale ?? defaultLocale;
  });

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

  const handleValueChange = (value: string) => {
    const translatedUrl = translateUrl(
      page.url.pathname,
      locale,
      value as Locale,
    );
    goto(translatedUrl, { invalidateAll: true });
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
