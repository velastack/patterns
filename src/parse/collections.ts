import type { Collection, CollectionField } from "./types";

export const DISPLAY_FIELD_CANDIDATES: string[] = [
  "title",
  "name",
  "label",
  "display",
  "display_name",
  "full_name",
  "first_name",
  "last_name",
  "given_name",
  "surname",
  "family_name",
  "username",
  "handle",
  "nickname",
  "email",
  "phone",
  "phone_number",
  "headline",
  "subject",
  "caption",
  "summary",
  "description",
  "sku",
  "code",
  "key",
  "identifier",
  "ref",
  "reference",
  "slug",
  "path",
  "url",
  "id",
];

export function pickDisplayField(
  fields: Array<Pick<CollectionField, "name" | "type">>,
): string {
  for (const candidate of DISPLAY_FIELD_CANDIDATES) {
    if (fields.some((f) => f.name === candidate)) {
      return candidate;
    }
  }
  return "id";
}

export function collectionNames(collections: Collection[]): string[] {
  return collections.map((c) => c.name).filter((n) => !n.startsWith("_"));
}

export function collectionIdMap(
  collections: Collection[],
): Record<string, string> {
  return Object.fromEntries(collections.map((c) => [c.name, c.id]));
}

export function collectionDisplayFieldMap(
  collections: Collection[],
): Record<string, string> {
  return Object.fromEntries(
    collections.map((c) => [c.name, pickDisplayField(c.fields)]),
  );
}
