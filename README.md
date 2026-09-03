# VelaStack Patterns

The registry for VelaStack patterns.

## Runtime

There's two modes this library can be used. One is in runtime, by the @velastack/cli. The VelaStack CLI uses
Commander to get inputs from the CLI and then calls the pattern:

The CLI determines what existing features are in use and passes feature flags to the `loadPattern()` function.
It also takes any additional wizard inputs from the CLI and passes the data as `input`.

```ts
const pattern = await registry.loadPattern("generate-form", {
  env: "runtime",
  argv: ["contact", "name:text", "email:email", "message:editor"],
  root: "/user/project",
  features: {
    auth: false,
    payments: false,
  },
  input: {},
});
```

## Preview

The other way is for the velastack.dev/patterns website. Each pattern is available for browsing. Each pattern
is loaded like this:

```ts
const pattern = await registry.loadPattern("generate-form", {
  env: "preview",
  argv: ["contact", "name:text", "email:email", "message:editor"],
});
```

In the runtime, @velastack/patterns loads libraries like `pocketbase` and `ts-morph` to make modifications to the user's project.
This isn't possible in the preview environment, so these changes are mocked with stock output. Keeping this separation is important.
Any libraries or node requirements must only be imported inside of `generate.runtime.ts` files.

Those dependencies are specified as `devDependencies` and also `optionalDependencies` for use with the CLI.

## File Structure

For each pattern, `generate.ts` is the main generator. As much of the pattern as possible should be configured here.
Libraries that can't be run in the preview environment are imported only in `generate.runtime.ts`, this async import
is only called during the runtime.

However, we still need examples of what `generate.runtime.ts` outputs, so we have `generate.preview.ts`, containing
a static version of what we'd typically get from the runtime.

Within each pattern, we have `creates`, `modifies` and `preview-modifies` directories.

### Creates

The `creates` directory is directly copied into the target project. Each file is bundled into the library using `import.meta.glob`.

### Modifies

The `modifies` directory contains scripts that modify the target project. Modifications use `ts-morph` when possible.
Each modification should have an extensive test suite with `fixtures/expect` and `fixtures/original` to ensure that
the modifications work across a wide range of project setups.

### Preview-Modifies

The `preview-modifies` directory is the mock modify output used only for previews. It's bundled in the same way as the `creates` directory.

## UI components

`src/ui/components/<name>` holds the components Vela ships itself (`data-table`, `multiselect`, `geopoint`,
`auth-menu`, ...). They are bundled as raw strings the same way `creates` are and copied into a project's
`src/lib/components/ui` by `installComponents()` in `src/runtime/write-result.ts`. Everything else a pattern
lists in `components` is handed to `shadcn-svelte add`, which resolves it from the style-scoped registry
(`/registry/styles/<style>/`) named by the project's `components.json`.

- `customDependencies` must list every `$lib/components/ui/<x>` a shipped component imports, and
  `customNpmPackages` every npm package no shadcn item installs for it.
- `installComponents()` is also exported from the package; `vela ui add` calls it. It is node-only and is
  loaded on the first call, the same rule as `generate.runtime.ts`. Before spawning `shadcn-svelte add` it
  checks bare item names against the style's registry index (`src/runtime/registry.ts`) and rejects
  unknown ones with an `InvalidArgumentError`; when the registry cannot be read the check is skipped.
- `listComponents()`, `switchStyle()`, `applyBaseColor()` and `applyTheme()` (`src/runtime/ui.ts`) back
  `vela ui list`, `vela ui style`, `vela ui base` and `vela ui theme`. Palette and font changes go through
  `shadcn-svelte apply --preset <code> --only theme|font`; the preset code is produced by the project's own
  `shadcn-svelte/preset` (`src/runtime/shadcn-preset.ts`), so the value lists never drift from what `apply`
  accepts. The one vendored table is `STYLE_FONTS` (each style's designed font), guarded by a test against
  the `shadcn-svelte` devDependency.
- `WriteResultRuntime.fetch` is the test seam for the registry, next to `executeCommand` for the spawns.

# Workflow for adding new patterns

- Develop the pattern in the `src/patterns` directory.
- Use the demo script to generate a temporary project with the pattern to see applied changes.
- In the temporary project, run `npm run test:server` to run the tests.
- Run `npm run lint` and `npm run check` to make sure the code is correct.
- Add the pattern to a case table in `integration/cases.ts` (`integration/coverage.test.ts` fails until every registered pattern is covered) and run its case.

# Integration tests

`npm run test:integration` scaffolds real projects with `vela create`, applies patterns the way the CLI
does (feature flags re-detected from disk between steps, `getCollections` reading the live schema) and
then requires zero svelte-check errors with `noUnusedLocals`, zero `failed` / `not-found` file entries and
prettier-clean output. `integration/cases.ts` holds one case per pattern plus stacks for patterns whose
output depends on feature detection. CI runs the five suites in parallel; see `.github/workflows/ci.yml`.

```sh
npm run test:integration -- integration/enable.test.ts            # one suite
npm run test:integration -- integration/stacks.test.ts -t "teams" # one case
```

- `VELA_BIN=/path/to/vela` picks the CLI (default: `vela` on PATH).
- `INTEGRATION_KEEP=1` keeps generated projects; failed cases are always kept.
- `INTEGRATION_SERVER_TESTS=1` also runs `vela test:server` after each checked step.
- `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` enable the payments cases; they skip otherwise.
- Failures point at `.integration-tests/<suite>/<case>/.integration/` (`commands.log`, `steps.json`,
  the raw svelte-check output). Expected failures live in `integration/known-failures.ts`, scoped per
  step or case, and turn into visible skips until they stop reproducing.
