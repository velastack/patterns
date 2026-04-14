<div class="space-y-2">
    <h3 class="font-medium leading-none"><%~ it.fieldLabel %></h3>
    <p class="text-muted-foreground">
<% if (!it.required) { %>
    {#if data.<%~ it.modelName %>.<%~ it.fieldName %>}
<% } %>
    <a href={data.<%~ it.modelName %>.<%~ it.fieldName %>} target="_blank" rel="noopener noreferrer">
        {data.<%~ it.modelName %>.<%~ it.fieldName %>}
    </a>
<% if (!it.required) { %>
    {/if}
<% } %>
    </p>
</div>
