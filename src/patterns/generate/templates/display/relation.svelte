<div class="space-y-2">
    <h3 class="font-medium leading-none"><%~ it.fieldLabel %></h3>
    <% if (it.multiple) { %>
{#each data.<%~ it.modelName %>.expand?.<%~ it.fieldName %> ?? [] as <%~ it.singularRelationName %>}
        <a
            href="<%~ it.relationModel.listUrl %>/{<%~ it.singularRelationName %>.id}"
        >
            <Badge variant="outline" class="text-muted-foreground">
                {<%~ it.singularRelationName %>.<%~ it.relationDisplayField %>}
                <CircleArrowRightIcon class="w-4 h-4" />
            </Badge>
        </a>
    {/each}
<% } else { %>
{#if data.<%~ it.modelName %>.expand?.<%~ it.fieldName %>}
        <a href="<%~ it.relationModel.listUrl %>/{data.<%~ it.modelName %>.expand?.<%~ it.fieldName %>.id}">
            <Badge variant="outline" class="text-muted-foreground">
                {data.<%~ it.modelName %>.expand?.<%~ it.fieldName %>.<%~ it.relationDisplayField %>}
                <CircleArrowRightIcon class="w-4 h-4" />
            </Badge>
        </a>
    {/if}
<% } %>
</div>
