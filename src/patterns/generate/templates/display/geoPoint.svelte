<div class="space-y-2">
    <h3 class="font-medium leading-none"><%~ it.fieldLabel %></h3>
<% if (!it.required) { %>
    {#if data.<%~ it.modelName %>.<%~ it.fieldName %>}
<% } %>
    {#await import('$lib/components/ui/leaflet/leaflet.svelte')}
        <div class="h-[225px] w-full bg-input rounded-md"></div>
    {:then { default: Leaflet }}
        <Leaflet point={data.<%~ it.modelName %>.<%~ it.fieldName %>} readonly class="rounded-md overflow-hidden" />
    {/await}
    <p class="text-muted-foreground">
        {data.<%~ it.modelName %>.<%~ it.fieldName %>?.lat.toFixed(6)}, {data.<%~ it.modelName %>.<%~ it.fieldName %>?.lon.toFixed(6)}
    </p>
<% if (!it.required) { %>
    {/if}
<% } %>
</div>
