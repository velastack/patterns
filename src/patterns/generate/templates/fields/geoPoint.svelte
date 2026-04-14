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
<GeopointInput {...props} bind:value={$formData.<%~ it.name %>} />
        {/snippet}
    </Form.Control>
    <Form.FieldErrors class="contents text-destructive" />
</Form.Field>
