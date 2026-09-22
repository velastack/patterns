<script
	lang="ts"
	generics="TFeatures extends TableFeatures, TData extends RowData, TValue extends CellData"
>
	import type {
		Cell,
		CellContext,
		CellData,
		ColumnDefTemplate,
		Header,
		HeaderContext,
		RowData,
		TableFeatures
	} from '@tanstack/table-core';
	import { RenderComponentConfig, RenderSnippetConfig } from './render-helpers.js';

	type Context = HeaderContext<TFeatures, TData, TValue> | CellContext<TFeatures, TData, TValue>;

	type Props =
		| {
				/** The `header`/`cell` template of a column definition. */
				content?: ColumnDefTemplate<Context>;
				/** What the header's or cell's `getContext()` returned. */
				context: Context;
				cell?: never;
				header?: never;
				footer?: never;
		  }
		| { cell: Cell<TFeatures, TData, TValue>; content?: never; context?: never; header?: never; footer?: never }
		| { header: Header<TFeatures, TData, TValue>; content?: never; context?: never; cell?: never; footer?: never }
		| { footer: Header<TFeatures, TData, TValue>; content?: never; context?: never; cell?: never; header?: never };

	let props: Props = $props();

	const resolved = $derived.by(() => {
		if (props.cell) {
			return { content: props.cell.column.columnDef.cell, context: props.cell.getContext() };
		}
		if (props.header) {
			return { content: props.header.column.columnDef.header, context: props.header.getContext() };
		}
		if (props.footer) {
			return { content: props.footer.column.columnDef.footer, context: props.footer.getContext() };
		}
		return { content: props.content, context: props.context };
	});

	const result = $derived(
		typeof resolved.content === 'function'
			? // A header template never receives a cell context and vice versa.
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(resolved.content as (context: any) => unknown)(resolved.context)
			: undefined
	);
</script>

{#if typeof resolved.content === 'string'}
	{resolved.content}
{:else if result instanceof RenderComponentConfig}
	<result.component {...result.props} />
{:else if result instanceof RenderSnippetConfig}
	{@render result.snippet(result.params)}
{:else if result !== undefined && result !== null}
	{result}
{/if}
