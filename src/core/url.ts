const DYNAMIC_PARAM_RE = /\[([^\]]+)\]/g;

function interpolateParams(template: string, paramSource: string): string {
  return template.replace(
    DYNAMIC_PARAM_RE,
    (_, name) => `\${${paramSource}.${name}}`,
  );
}

/**
 * JS source for a URL value: a quoted string when the URL has no dynamic
 * params, otherwise a template literal that interpolates them via
 * `${paramSource.<name>}`.
 *
 *     urlJsExpr("/projects", [])           => '"/projects"'
 *     urlJsExpr("/[team_id]/projects", ["team_id"])
 *                                          => '`/${params.team_id}/projects`'
 */
export function urlJsExpr(
  template: string,
  dynamicParams: string[],
  paramSource = "params",
): string {
  if (dynamicParams.length === 0) {
    return JSON.stringify(template);
  }
  return `\`${interpolateParams(template, paramSource)}\``;
}

/**
 * JS template-literal source for a URL value followed by a JS-template-literal
 * suffix (already containing any `${...}` interpolations the caller wants).
 * Always returns a template literal — even with no dynamic params — because
 * the suffix usually carries one.
 *
 *     urlJsExprWithSuffix("/projects", [], "/${id}")
 *                                          => '`/projects/${id}`'
 *     urlJsExprWithSuffix("/[team_id]/projects", ["team_id"], "/${id}")
 *                                          => '`/${params.team_id}/projects/${id}`'
 */
export function urlJsExprWithSuffix(
  template: string,
  dynamicParams: string[],
  suffix: string,
  paramSource = "params",
): string {
  const head =
    dynamicParams.length === 0
      ? template
      : interpolateParams(template, paramSource);
  return `\`${head}${suffix}\``;
}

/**
 * Svelte attribute source for a URL — the `=` sign and value together, so the
 * caller writes the attribute name then drops this in:
 *
 *     `<Button href${urlSvelteAttrValue(url, params)}>`
 *
 * Result:
 *     urlSvelteAttrValue("/projects", [])  => '="/projects"'
 *     urlSvelteAttrValue("/[team_id]/projects", ["team_id"])
 *                                          => '={`/${params.team_id}/projects`}'
 *
 * `svelteSuffix` lets the caller append additional path segments that may
 * themselves contain Svelte mustache interpolations like `/{data.x.id}`. In
 * the dynamic case those `{var}` segments are converted to JS `${var}` so the
 * whole expression becomes a single template literal.
 *
 *     urlSvelteAttrValue("/projects", [], "/{data.x.id}/edit")
 *                                          => '="/projects/{data.x.id}/edit"'
 *     urlSvelteAttrValue("/[team_id]/projects", ["team_id"], "/{data.x.id}/edit")
 *                                          => '={`/${params.team_id}/projects/${data.x.id}/edit`}'
 */
export function urlSvelteAttrValue(
  template: string,
  dynamicParams: string[],
  svelteSuffix = "",
  paramSource = "params",
): string {
  if (dynamicParams.length === 0) {
    return `="${template}${svelteSuffix}"`;
  }
  // Convert Svelte mustache `{var}` to JS `${var}`, but leave any preexisting
  // `${var}` alone (negative lookbehind on `$`).
  const jsSuffix = svelteSuffix.replace(/(?<!\$)\{([^}]+)\}/g, "${$1}");
  return `={\`${interpolateParams(template, paramSource)}${jsSuffix}\`}`;
}

/**
 * Substitute dynamic params with `test_<name>` placeholders. Used in generated
 * test fixtures where param values must be supplied as literals.
 */
export function testFixtureUrl(template: string): string {
  return template.replace(DYNAMIC_PARAM_RE, (_, name) => `test_${name}`);
}
