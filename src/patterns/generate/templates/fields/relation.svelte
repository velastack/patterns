<MultiSelect.Field {form} type="<%~ it.multiple ? 'multiple' : 'single' %>" name="<%~ it.name %>" class="col-span-1">
    <Form.Control>
        {#snippet children({ props })}
            <Form.Label><%~ it.title %></Form.Label>
            <MultiSelect.Trigger class="w-full justify-between">
                <MultiSelect.Input
                    bind:value={$formData.<%~ it.name %>}
                    placeholder="Select <%~ it.multiple ? it.relationModel.pluralSplitName.toLowerCase() : it.relationModel.singular.toLowerCase() %>"
                    {...props}
                >
                    {#snippet children({ selected })}
                        <div class="flex flex-wrap gap-1">
                            {#each selected as value}
                                {@const <%~ it.relationModel.name %> = data.<%~ it.relationModel.pluralName %>.find((<%~ it.relationModel.name %>) => <%~ it.relationModel.name %>.id === value)!}
                                <MultiSelect.Chip>
                                    {<%~ it.relationModel.name %>.<%~ it.relationDisplayField %>}
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
            <Command.Input autofocus placeholder="Search <%~ it.relationModel.pluralSplitName.toLowerCase() %>..." />
            <Command.Empty>No <%~ it.relationModel.pluralSplitName.toLowerCase() %> found</Command.Empty>
            <Command.Group>
                {#each data.<%~ it.relationModel.pluralName %> as <%~ it.relationModel.name %>}
                    <MultiSelect.Item value={<%~ it.relationModel.name %>.id} label={<%~ it.relationModel.name %>.<%~ it.relationDisplayField %>} />
                {/each}
            </Command.Group>
        </Command.Root>
    </MultiSelect.Content>

    <Form.FieldErrors class="contents text-destructive" />
</MultiSelect.Field>
