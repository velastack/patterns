<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
	import * as FormPrimitive from 'formsnap';
	import type { FormPath } from 'sveltekit-superforms';
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import { setContext } from 'svelte';
	import * as Popover from '$lib/components/ui/popover';

	let {
		ref = $bindable(null),
		class: className,
		type,
		form,
		name,
		required,
		children: childrenProp,
		...restProps
	}: FormPrimitive.FieldProps<T, U> & {
		type: 'multiple' | 'single';
		required?: boolean;
	} & WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();

	const { form: formData } = form;

	const toggleSelected = (value: string) => {
		if (type === 'single') {
			if (!required && $formData[name] === value) {
				$formData[name] = undefined as T[U];
			} else {
				$formData[name] = value as T[U];
			}
		} else if (type === 'multiple') {
			if (!$formData[name]) {
				$formData[name] = [] as T[U];
			}

			const currentValue = $formData[name] as string[];
			const index = currentValue.indexOf(value);

			if (index > -1) {
				$formData[name] = currentValue.filter((id) => id !== value) as T[U];
			} else {
				$formData[name] = [...currentValue, value] as T[U];
			}
		}
	};

	const isSelected = (value: string) => {
		if (type === 'single') {
			return $formData[name] === value;
		} else if (type === 'multiple') {
			return ($formData[name] as string[])?.includes(value) ?? false;
		}
	};

	setContext('multiselect-field', {
		form,
		name,
		type,
		toggleSelected,
		isSelected
	});
</script>

<Popover.Root>
	<FormPrimitive.Field {form} {name}>
		{#snippet children({ constraints, errors, tainted, value })}
			<div bind:this={ref} data-slot="form-item" class={cn('space-y-2', className)} {...restProps}>
				{@render childrenProp?.({ constraints, errors, tainted, value: value as T[U] })}
			</div>
		{/snippet}
	</FormPrimitive.Field>
</Popover.Root>
