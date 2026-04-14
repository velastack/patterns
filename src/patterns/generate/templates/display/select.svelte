<div class="space-y-2">
    <h3 class="font-medium leading-none"><%~ it.fieldLabel %></h3>
<% if (it.multiple) { %>
    {#each data.<%~ it.modelName %>.<%~ it.fieldName %> as <%~ it.fieldName %>}
        <Badge variant="outline" class="mr-1">{<%~ it.fieldName %>Labels[<%~ it.fieldName %>].label}</Badge>
    {/each}
<% } else { %>
<% if (!it.required) { %>
    {#if data.<%~ it.modelName %>.<%~ it.fieldName %>}
<% } %>
    <Badge variant="outline" class="mr-1">{<%~ it.fieldName %>Labels[data.<%~ it.modelName %>.<%~ it.fieldName %>].label}</Badge>
<% if (!it.required) { %>
    {/if}
<% } %>
<% } %>
</div>
