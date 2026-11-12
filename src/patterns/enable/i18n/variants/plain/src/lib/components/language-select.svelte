<script lang="ts">
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

  const handleChange = async (
    event: Event & { currentTarget: HTMLSelectElement },
  ) => {
    const value = event.currentTarget.value as Locale;
    // Remembered for the pages that have no language in their URL.
    document.cookie = localeCookie(value);

    if (hasLocalizedUrl(page.url.pathname)) {
      await goto(translateUrl(page.url.pathname, locale, value), {
        refreshAll: true,
      });
    } else {
      await invalidateAll();
    }
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
