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
  argv: [
    "generate",
    "form",
    "contact",
    "name:text",
    "email:email",
    "message:textarea",
  ],
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
  env: "browser",
  argv: [
    "generate",
    "form",
    "contact",
    "name:text",
    "email:email",
    "message:textarea",
  ],
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
