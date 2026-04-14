<% if (it.multiple) { %>
<div class="space-y-2">
    <h3 class="font-medium leading-none"><%~ it.fieldLabel %></h3>
    {#if data.<%~ it.modelName %>.<%~ it.fieldName %>}
        {#each data.<%~ it.modelName %>.<%~ it.fieldName %> as filename}
            <div class="flex gap-2 items-center">
                {#if ['.jpg', '.png', '.jpeg', '.webp', '.gif'].some((ext) => filename.endsWith(ext))}
                    <img
                        src="/api/files/{data.<%~ it.modelName %>.collectionId}/{data.<%~ it.modelName %>.id}/{filename}"
                        alt={filename}
                        class="w-16 h-16 rounded-md object-cover"
                    />
                {:else}
                    <div class="flex items-center justify-center w-16 h-16 bg-muted rounded-md">
                        <FileIcon class="w-4 h-4" />
                    </div>
                {/if}
                <p class="text-sm text-muted-foreground">{filename}</p>
            </div>
        {/each}
    {/if}
</div>
<% } else { %>
<div class="space-y-2">
    <h3 class="font-medium leading-none"><%~ it.fieldLabel %></h3>
    {#if data.<%~ it.modelName %>.<%~ it.fieldName %>}
        <div class="flex gap-2 items-center">
            {#if ['.jpg', '.png', '.jpeg', '.webp', '.gif'].some( (ext) => data.<%~ it.modelName %>.<%~ it.fieldName %>?.endsWith(ext) )}
                <img
                    src="/api/files/{data.<%~ it.modelName %>.collectionId}/{data.<%~ it.modelName %>.id}/{data.<%~ it.modelName %>.<%~ it.fieldName %>}"
                    alt={data.<%~ it.modelName %>.<%~ it.fieldName %>}
                    class="w-16 h-16 rounded-md object-cover"
                />
            {:else}
                <div class="flex items-center justify-center w-16 h-16 bg-muted rounded-md">
                    <FileIcon class="w-4 h-4" />
                </div>
            {/if}
            <p class="text-sm text-muted-foreground">{data.<%~ it.modelName %>.<%~ it.fieldName %>}</p>
        </div>
    {/if}
</div>
<% } %>
