import * as changeCase from "change-case";
import pluralize from "pluralize";
import { APP_DIR, PUBLIC_DIR } from "../core/constants";
import type { Options } from "../core/types";
import type { Model, ModelPaths, ModelUrls } from "./types";

const RESERVED_WORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "package",
  "protected",
  "private",
  "public",
  "interface",
  "enum",
  "implements",
  "type",
  "namespace",
  "null",
  "true",
  "false",
  "await",
  "async",
  "arguments",
  "constructor",
]);

const RESERVED_ALIASES: Record<string, string> = {
  function: "fn",
  interface: "iface",
  type: "type_",
  enum: "enum_",
  const: "const_",
  let: "let_",
  var: "var_",
  class: "class_",
  default: "default_",
  delete: "delete_",
  new: "new_",
  import: "import_",
  export: "export_",
  extends: "extends_",
  super: "super_",
  return: "return_",
  case: "case_",
  switch: "switch_",
  try: "try_",
  catch: "catch_",
  finally: "finally_",
  do: "do_",
  while: "while_",
  for: "for_",
  if: "if_",
  in: "in_",
  of: "of_",
  with: "with_",
  this: "this_",
  throw: "throw_",
  void: "void_",
  typeof: "typeOf",
  instanceof: "instanceOf",
  yield: "yield_",
  await: "await_",
  async: "async_",
  implements: "implements_",
  package: "package_",
  private: "private_",
  protected: "protected_",
  public: "public_",
  namespace: "namespace_",
  null: "nullValue",
  true: "trueValue",
  false: "falseValue",
  arguments: "args",
  constructor: "ctor",
};

export function safeVarName(str: string): string {
  if (RESERVED_WORDS.has(str)) {
    return RESERVED_ALIASES[str] ?? `${str}_`;
  }
  return str;
}

export function validateModelName(model: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9-_/]*$/.test(model)) {
    throw new Error(
      "Model path must start with a letter and contain only alphanumeric characters, dash, slash, or underscore",
    );
  }
}

function routesDir(options: Pick<Options, "features">): string {
  if (options.features.auth) {
    return `src/routes/${APP_DIR}`;
  }
  return `src/routes/${PUBLIC_DIR}`;
}

export function parseModel(
  modelPath: string,
  options: Pick<Options, "features">,
): Model {
  const parts = modelPath.split("/");
  const finalPart = parts[parts.length - 1];
  const restParts = parts.slice(0, -1);

  const displayName = pluralize.singular(changeCase.capitalCase(finalPart));
  const pluralDisplay = pluralize.plural(displayName);

  const name = changeCase.camelCase(displayName);
  const urlName = changeCase.kebabCase(pluralDisplay);
  const segment = [...restParts, urlName].join("/");

  return {
    name: safeVarName(name),
    pluralName: safeVarName(changeCase.camelCase(pluralDisplay)),
    typeName: changeCase.pascalCase(displayName),
    tableName: changeCase.snakeCase(pluralDisplay),
    displayName,
    pluralDisplayName: pluralDisplay,
    schemaName: `${safeVarName(name)}Schema`,
    routeSegment: segment,
    routesDir: routesDir(options),
  };
}

export function modelPaths(model: Model): ModelPaths {
  const base = `${model.routesDir}/${model.routeSegment}`;
  return {
    list: base,
    new: `${base}/new`,
    show: `${base}/[id]`,
    edit: `${base}/[id]/edit`,
  };
}

export function modelUrls(model: Model): ModelUrls {
  const base = `/${model.routeSegment}`;
  return {
    list: base,
    new: `${base}/new`,
    show: `${base}/[id]`,
    edit: `${base}/[id]/edit`,
  };
}
