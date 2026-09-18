import { describe, expect, it } from "vitest";
import type { Field, Model } from "../../parse";
import {
  NATIVE_STYLE,
  SHADCN_STYLE,
  geoPointState,
  plainRenderer,
  remoteBinding,
  superformsBinding,
  usesConstraints,
} from "./plain";

const relatedModel: Model = {
  name: "author",
  pluralName: "authors",
  typeName: "Author",
  tableName: "authors",
  displayName: "Author",
  pluralDisplayName: "Authors",
  schemaName: "authorSchema",
};

function compact(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

const field = (partial: Record<string, unknown>) =>
  ({ title: "Title", required: false, ...partial }) as unknown as Field;

describe("plainRenderer with the superforms binding", () => {
  const { render } = plainRenderer(superformsBinding(), NATIVE_STYLE);

  it("binds an input to the stores and wires errors for assistive tech", () => {
    const html = compact(
      render(field({ name: "email", type: "email", required: true })),
    );

    expect(html).toContain(
      '<div data-field="email" data-invalid={$errors.email ? "" : undefined}>',
    );
    expect(html).toContain('<label for="email">Title</label>');
    expect(html).toContain(
      '<input id="email" name="email" type="email" bind:value={$formData.email} aria-invalid={$errors.email ? "true" : undefined} aria-describedby={$errors.email ? "email-error" : undefined} {...$constraints.email} />',
    );
    expect(html).toContain(
      '{#if $errors.email} <p id="email-error" data-error>{$errors.email}</p> {/if}',
    );
  });

  it("emits no components and no classes", () => {
    const types = ["text", "number", "date", "url", "editor", "json", "bool"];
    for (const type of types) {
      const html = render(field({ name: "f", type }));
      expect(html).not.toMatch(/<[A-Z]/);
      expect(html).not.toContain("class=");
    }
  });

  it("closes textareas explicitly", () => {
    expect(render(field({ name: "body", type: "editor" }))).toContain(
      "></textarea>",
    );
  });

  it("binds checkboxes with bind:checked", () => {
    expect(render(field({ name: "done", type: "bool" }))).toContain(
      'type="checkbox" bind:checked={$formData.done}',
    );
  });

  it("renders select options natively and reads array errors from _errors", () => {
    const html = compact(
      render(
        field({
          name: "tags",
          type: "select",
          maxSelect: 3,
          required: true,
          options: [
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ],
        }),
      ),
    );

    expect(html).toContain(
      '<select id="tags" name="tags" bind:value={$formData.tags}',
    );
    expect(html).toContain(" multiple required>");
    expect(html).toContain('<option value="a">Alpha</option>');
    expect(html).toContain("{#if $errors.tags?._errors}");
  });

  it("lists related records from page data", () => {
    const html = compact(
      render(
        field({
          name: "author",
          type: "relation",
          maxSelect: 1,
          relatedModel,
          displayField: "name",
        }),
      ),
    );

    expect(html).toContain('<option value="">Select author</option>');
    expect(html).toContain("{#each data.authors as author}");
    expect(html).toContain("<option value={author.id}>{author.name}</option>");
  });

  it("posts multi-file fields under PocketBase's append key", () => {
    const single = render(
      field({ name: "avatar", type: "file", maxSelect: 1 }),
    );
    const multi = render(field({ name: "photos", type: "file", maxSelect: 5 }));

    expect(single).toContain('name="avatar" type="file"');
    expect(single).toContain("$formData.avatar = e.currentTarget.files?.[0]");
    expect(multi).toContain('name="photos+" type="file"');
    expect(multi).toContain('$formData["photos+"] = Array.from(');
    expect(multi).toContain(" multiple");
  });

  it("splits a geoPoint into lat/lon inputs backed by script state", () => {
    const geo = field({ name: "location", type: "geoPoint" });
    const html = compact(render(geo));

    expect(html).toContain("bind:value={locationPoint.lat}");
    expect(html).toContain(
      '<input type="hidden" name="location" value={$formData.location} />',
    );
    expect(geoPointState([geo])).toContain(
      "$formData.location = JSON.stringify(locationPoint);",
    );
  });

  it("only asks for $constraints when a field spreads them", () => {
    expect(usesConstraints([field({ name: "a", type: "bool" })])).toBe(false);
    expect(usesConstraints([field({ name: "a", type: "text" })])).toBe(true);
  });
});

describe("plainRenderer with the remote binding", () => {
  it("keeps shadcn inputs and tailwind classes by default", () => {
    const html = compact(
      plainRenderer(remoteBinding("submitForm"), SHADCN_STYLE).render(
        field({ name: "email", type: "email", required: true }),
      ),
    );

    expect(html).toContain('<div class="space-y-2 col-span-1">');
    expect(html).toContain(
      '<Input id="email" {...submitForm.fields.email.as("text")} type="email" required />',
    );
    expect(html).toContain('<p class="text-destructive text-sm">');
  });

  it("drops components and classes with the native style", () => {
    const html = compact(
      plainRenderer(remoteBinding("submitForm"), NATIVE_STYLE).render(
        field({ name: "age", type: "number" }),
      ),
    );

    expect(html).toContain(
      '<div data-field="age" data-invalid={submitForm.fields.age.issues()?.length ? "" : undefined}>',
    );
    expect(html).toContain(
      '<input id="age" {...submitForm.fields.age.as("number")} />',
    );
    expect(html).toContain("<p data-error>{issue.message}</p>");
  });

  it("leaves a TODO for field types remote forms cannot express", () => {
    expect(
      plainRenderer(remoteBinding("f"), NATIVE_STYLE).render(
        field({ name: "loc", type: "geoPoint" }),
      ),
    ).toBe(
      '<!-- TODO: geoPoint field "loc" is not yet supported by the remote form variant -->',
    );
  });
});
