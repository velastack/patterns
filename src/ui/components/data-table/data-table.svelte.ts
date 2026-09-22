import {
  type CellData,
  type RowData,
  type Table,
  type TableFeatures,
  type TableOptions,
  constructTable,
} from "@tanstack/table-core";
import type {
  TableAtomOptions,
  TableReactivityBindings,
} from "@tanstack/table-core/reactivity";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";
import { untrack } from "svelte";

declare module "@tanstack/table-core" {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /** Classes for the column's header and body cells; pages read `columnDef.meta?.class`. */
    class?: string;
  }
}

/**
 * Creates a reactive TanStack Table (v9) for Svelte 5.
 *
 * A local copy of `createTable` from `@tanstack/svelte-table`, so a project
 * needs only `@tanstack/table-core`. Table APIs and `table.atoms.<slice>.get()`
 * reads are reactive in templates, `$derived` and `$effect`; pass rune values
 * such as `data` through getters so the table sees their changes.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
 *   const table = createTable({
 *     features,
 *     columns,
 *     get data() {
 *       return data.items;
 *     },
 *   });
 * </script>
 *
 * <table>
 *   <thead>
 *     {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
 *       <tr>
 *         {#each headerGroup.headers as header (header.id)}
 *           <th colspan={header.colSpan}><FlexRender {header} /></th>
 *         {/each}
 *       </tr>
 *     {/each}
 *   </thead>
 *   <!-- ... -->
 * </table>
 * ```
 */
export function createTable<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(tableOptions: TableOptions<TFeatures, TData>): Table<TFeatures, TData> {
  const mergedOptions = mergeObjects(tableOptions, {
    features: {
      coreReactivityFeature: svelteReactivity(),
      ...tableOptions.features,
    },
  });

  const resolvedOptions = mergeObjects(
    {
      mergeOptions: (
        defaultOptions: TableOptions<TFeatures, TData>,
        newOptions: Partial<TableOptions<TFeatures, TData>>,
      ) => flatMerge(defaultOptions, newOptions),
    },
    mergedOptions,
  );

  const table = constructTable(resolvedOptions);

  // Getters are resolved outside `untrack` so rune-backed `data`, columns and
  // controlled state become dependencies; `setOptions` runs inside it so the
  // write does not subscribe this effect to the table's own atoms. `pre`, so
  // `getRowModel()` sees the new options before the DOM updates.
  $effect.pre(() => {
    const nextOptions = flatMerge(mergedOptions);
    const state = nextOptions.state as Record<string, unknown> | undefined;
    if (state) {
      for (const key in state) {
        void state[key];
      }
    }
    untrack(() => {
      table.setOptions((prev) => flatMerge(prev, nextOptions));
    });
  });

  return table;
}

type Observer<T> = ((value: T) => void) | { next?: (value: T) => void };

const OPTIONS_STORE = "table/optionsStore";

function subscribeToRune<T>(getValue: () => T, observer: Observer<T>) {
  const callback =
    typeof observer === "function"
      ? observer
      : (value: T) => observer.next?.(value);
  const unsubscribe = $effect.root(() => {
    $effect(() => {
      const value = getValue();
      untrack(() => callback(value));
    });
  });
  return { unsubscribe };
}

/**
 * The table's atoms are TanStack Store atoms (table-core's own copy, so they
 * share its dependency tracking); readonly ones are bridged into runes so a
 * `.get()` in a template or `$derived` re-runs when the atom changes. The
 * options store is a plain rune, since row models read `table.options` during
 * render.
 */
function svelteReactivity(): TableReactivityBindings {
  const store = storeReactivityBindings();

  function createReadonlyAtom<T>(
    fn: () => T,
    options?: TableAtomOptions<T>,
  ): ReturnType<typeof store.createReadonlyAtom<T>> {
    const atom = store.createReadonlyAtom(fn, options);
    let version = $state(0);
    $effect(() => {
      const subscription = atom.subscribe(() => {
        version += 1;
      });
      return () => subscription.unsubscribe();
    });
    const value = $derived.by(() => {
      void version;
      return atom.get();
    });

    return {
      // Both reads matter: the atom read keeps store-level tracking between
      // table atoms, and `value` registers the current Svelte scope.
      get: () => {
        const current = atom.get();
        void value;
        return current;
      },
      subscribe: ((observer: Observer<T>) =>
        subscribeToRune(() => value, observer)) as typeof atom.subscribe,
    };
  }

  function createWritableAtom<T>(
    initialValue: T,
    options?: TableAtomOptions<T>,
  ): ReturnType<typeof store.createWritableAtom<T>> {
    if (options?.debugName !== OPTIONS_STORE) {
      return store.createWritableAtom(initialValue, options);
    }
    let value = $state(initialValue);
    return {
      get: () => value,
      set: (updater: T | ((prev: T) => T)) => {
        value =
          typeof updater === "function"
            ? (updater as (prev: T) => T)(value)
            : updater;
      },
      subscribe: ((observer: Observer<T>) =>
        subscribeToRune(() => value, observer)) as ReturnType<
        typeof store.createWritableAtom<T>
      >["subscribe"],
    };
  }

  return { ...store, untrack, createReadonlyAtom, createWritableAtom };
}

type MaybeThunk<T extends object> = T | (() => T | null | undefined);
type Intersection<T extends readonly unknown[]> = (T extends [
  infer H,
  ...infer R,
]
  ? H & Intersection<R>
  : unknown) & {};

/**
 * Merges objects while keeping their getters alive: every key reads through
 * to the last source that defines it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeObjects<Sources extends readonly MaybeThunk<any>[]>(
  ...sources: Sources
): Intersection<{ [K in keyof Sources]: Sources[K] }> {
  const target = {};
  for (let source of sources) {
    if (typeof source === "function") source = source();
    if (!source) continue;
    for (const key of Object.keys(Object.getOwnPropertyDescriptors(source))) {
      if (key in target) continue;
      Object.defineProperty(target, key, {
        enumerable: true,
        get() {
          for (let i = sources.length - 1; i >= 0; i--) {
            let s = sources[i];
            if (typeof s === "function") s = s();
            const v = (s || {})[key];
            if (v !== undefined) return v;
          }
        },
      });
    }
  }
  return target as Intersection<{ [K in keyof Sources]: Sources[K] }>;
}

/**
 * Merges objects by reading every value once, so repeated merges inside the
 * sync effect do not build ever-longer getter chains. Later sources win;
 * `undefined` never overrides.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flatMerge<Sources extends readonly MaybeThunk<any>[]>(
  ...sources: Sources
): Intersection<{ [K in keyof Sources]: Sources[K] }> {
  const result: Record<PropertyKey, unknown> = {};
  for (let source of sources) {
    if (typeof source === "function") source = source();
    if (!source) continue;
    for (const key of Reflect.ownKeys(source)) {
      const value = source[key];
      if (value !== undefined) result[key] = value;
    }
  }
  return result as Intersection<{ [K in keyof Sources]: Sources[K] }>;
}
