<Form.Field {form} name="<%~ it.name %>" class="col-span-1">
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
<Input {...props} type="text" value={$formData.<%~ it.name %>}<%~ it.inputProps %> readonly />
        {/snippet}
    </Form.Control>
    <Form.FieldErrors class="contents text-destructive" />
</Form.Field>
