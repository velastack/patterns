<FileForm.Field {form} name="<%~ it.name %>" class="col-span-1">
    <Form.Control>
        {#snippet children({ props })}
            <% if (it.labelAside) { %>
                <div class="flex justify-between">
                    <Form.Label><%~ it.title %></Form.Label>
                    <%~ it.labelAside %>
                </div>
            <% } else { %>
<Form.Label><%~ it.title %></Form.Label>
            <% } %>
<FileForm.<%~ it.multiple ? 'Multiple' : 'Single' %>>
                {#snippet display({ file, filename, onremove })}
                    <div class="flex gap-2 justify-between items-center">
                        <div class="flex gap-2 items-center">
                            <FileForm.Thumb
                                {file}
                                {filename}
                                class="w-16 h-16 rounded-md object-cover"
                            />
                            <p class="text-sm text-muted-foreground">{filename}</p>
                        </div>
                        <Button variant="outline" onclick={() => onremove(file)}>Remove</Button>
                    </div>
                {/snippet}
                {#snippet input()}
                    <FileForm.Input {...props}<%~ it.required ? ' required' : '' %><%~ it.inputProps %> />
                {/snippet}
            </FileForm.<%~ it.multiple ? 'Multiple' : 'Single' %>>
        {/snippet}
    </Form.Control>
    <Form.FieldErrors class="contents text-destructive" />
</FileForm.Field>
