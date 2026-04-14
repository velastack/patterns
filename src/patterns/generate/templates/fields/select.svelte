<MultiSelect.Field {form} type="<%~ it.multiple ? 'multiple' : 'single' %>" name="<%~ it.name %>"<%~ it.required ? ' required' : '' %> class="col-span-1">
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
            <MultiSelect.Trigger class="w-full justify-between">
                <MultiSelect.Input
                    bind:value={$formData.<%~ it.name %>}
                    placeholder="Select <%~ it.multiple ? 'options' : 'an option' %>"
                    {...props}
                >
                    {#snippet children({ selected })}
                        <div class="flex flex-wrap gap-1">
                            {#each selected as value}
                                <MultiSelect.Chip>
                                    {<%~ it.fieldName %>Labels[value].label}
                                </MultiSelect.Chip>
                            {/each}
                        </div>
                    {/snippet}
                </MultiSelect.Input>
            </MultiSelect.Trigger>
        {/snippet}
    </Form.Control>

    <MultiSelect.Content class="p-0">
        <Command.Root>
            <Command.Input autofocus placeholder="Search..." />
            <Command.Empty>No options found</Command.Empty>
            <Command.Group>
<% it.values.forEach(function(value) { %>
                <MultiSelect.Item value="<%~ value %>" label={<%~ it.fieldName %>Labels["<%~ value %>"].label} />
<% }) %>
            </Command.Group>
        </Command.Root>
    </MultiSelect.Content>

    <Form.FieldErrors class="contents text-destructive" />
</MultiSelect.Field>
