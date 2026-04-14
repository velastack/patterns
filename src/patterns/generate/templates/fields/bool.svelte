<Form.Field {form} name="<%~ it.name %>" class="col-span-1 flex items-start space-x-2">
    <Form.Control>
        {#snippet children({ props })}
            <Checkbox {...props} bind:checked={$formData.<%~ it.name %>}<%~ it.required ? ' required' : '' %><%~ it.inputProps %> />
            <% if (it.labelAside) { %>
                <div class="flex justify-between">
                    <Form.Label><%~ it.title %></Form.Label>
                    <%~ it.labelAside %>
                </div>
            <% } else { %>
<Form.Label><%~ it.title %></Form.Label>
        <% } %>
{/snippet}
    </Form.Control>
    <Form.FieldErrors class="contents text-destructive" />
</Form.Field>
