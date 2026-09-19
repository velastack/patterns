<script lang="ts">
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

  const handleChange = (
    event: Event & { currentTarget: HTMLSelectElement },
  ) => {
    const translatedUrl = translateUrl(
      page.url.pathname,
      locale,
      event.currentTarget.value as Locale,
    );
    goto(translatedUrl, { invalidateAll: true });
  };

  let { class: className }: { class?: string } = $props();
</script>

<select
  class={className}
  aria-label="Language"
  value={locale}
  onchange={handleChange}
>
  {#each locales as code (code)}
    <option value={code}>{localeNames[code]}</option>
  {/each}
</select>
