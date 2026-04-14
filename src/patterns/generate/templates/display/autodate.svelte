<div class="space-y-2">
    <h3 class="font-medium leading-none"><%~ it.fieldLabel %></h3>
<% if (!it.required) { %>
    {#if data.<%~ it.modelName %>.<%~ it.fieldName %>}
<% } %>
    <p class="text-muted-foreground">{new Date(data.<%~ it.modelName %>.<%~ it.fieldName %>).toLocaleDateString()}</p>
<% if (!it.required) { %>
    {/if}
<% } %>
</div>
