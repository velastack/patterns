<script lang="ts">
	import * as Pagination from '#lib/components/ui/pagination/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import type {
		PaginationState,
		Table_RowModels_Filtered,
		Table_RowPagination,
		Table_RowSelection
	} from '@tanstack/table-core';

	let {
		table
	}: {
		// Any table with the pagination, row selection and column filtering features.
		table: Table_RowPagination<any, any> &
			Table_RowSelection<any, any> &
			Table_RowModels_Filtered<any, any> & { atoms: { pagination: { get(): PaginationState } } };
	} = $props();

	const pagination = $derived(table.atoms.pagination.get());
	const rows = $derived(table.getFilteredRowModel().rows.length);
</script>

<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-2">
	<div class="text-muted-foreground flex-1 text-sm whitespace-nowrap">
		{table.getFilteredSelectedRowModel().rows.length} of
		{rows} row(s) selected.
	</div>
	<div class="flex items-center space-x-2">
		<p class="text-sm font-medium whitespace-nowrap">Rows per page</p>
		<Select.Root
			allowDeselect={false}
			type="single"
			value={`${pagination.pageSize}`}
			onValueChange={(value) => {
				table.setPageSize(Number(value));
			}}
		>
			<Select.Trigger class="h-8 w-[70px]">
				{String(pagination.pageSize)}
			</Select.Trigger>
			<Select.Content side="top">
				{#each [10, 20, 30, 40, 50] as pageSize (pageSize)}
					<Select.Item value={`${pageSize}`}>
						{pageSize}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
	<!-- The table owns the page: shadcn-svelte's pagination shows it and asks for another. -->
	<Pagination.Root
		class="mx-0 w-auto"
		count={rows}
		perPage={pagination.pageSize}
		page={pagination.pageIndex + 1}
		onPageChange={(page) => table.setPageIndex(page - 1)}
	>
		{#snippet children({ pages, currentPage })}
			<Pagination.Content>
				<Pagination.Item>
					<Pagination.Previous />
				</Pagination.Item>
				{#each pages as page (page.key)}
					<Pagination.Item>
						{#if page.type === 'ellipsis'}
							<Pagination.Ellipsis />
						{:else}
							<Pagination.Link {page} isActive={currentPage === page.value} />
						{/if}
					</Pagination.Item>
				{/each}
				<Pagination.Item>
					<Pagination.Next />
				</Pagination.Item>
			</Pagination.Content>
		{/snippet}
	</Pagination.Root>
</div>
