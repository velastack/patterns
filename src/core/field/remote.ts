import type { Field } from "../../parse";
import {
  NATIVE_STYLE,
  SHADCN_STYLE,
  plainRenderer,
  remoteBinding,
} from "./plain";

export type RemoteFieldComponent = "input" | "textarea" | "button";

const REMOTE_FIELD_COMPONENTS: Record<Field["type"], RemoteFieldComponent[]> = {
  text: ["input"],
  number: ["input"],
  email: ["input"],
  password: ["input"],
  url: ["input"],
  date: ["input"],
  bool: [],
  editor: ["textarea"],
  json: ["textarea"],
  select: [],
  file: [],
  autodate: ["input"],
  geoPoint: [],
  relation: [],
};

const REMOTE_FIELD_IMPORTS: Record<RemoteFieldComponent, string> = {
  input: 'import { Input } from "$lib/components/ui/input";',
  textarea: 'import { Textarea } from "$lib/components/ui/textarea";',
  button: 'import { Button } from "$lib/components/ui/button";',
};

export function getRemoteFieldComponents(
  fields: Field[],
): RemoteFieldComponent[] {
  const components = fields.flatMap(
    (field) => REMOTE_FIELD_COMPONENTS[field.type],
  );
  return [...new Set(components)];
}

export function getRemoteFieldImports(
  components: RemoteFieldComponent[],
): string[] {
  return components.map((component) => REMOTE_FIELD_IMPORTS[component]);
}

interface RemoteRenderOptions {
  formVar: string;
  /** Bare elements instead of shadcn's `Input`/`Textarea`; see `PlainStyle`. */
  native?: boolean;
}

export function renderRemoteField(
  field: Field,
  options: RemoteRenderOptions,
): string {
  return plainRenderer(
    remoteBinding(options.formVar),
    options.native ? NATIVE_STYLE : SHADCN_STYLE,
  ).render(field);
}
