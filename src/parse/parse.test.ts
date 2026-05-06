import { describe, expect, it } from "vitest";
import {
  parseModel,
  modelPaths,
  modelUrls,
  validateModelName,
  safeVarName,
} from "./model";
import { resolveFields, splitFieldDef, parseSelectOptions } from "./fields";
import {
  pickDisplayField,
  collectionIdMap,
  collectionDisplayFieldMap,
  collectionNames,
} from "./collections";
import { generateAuthRule } from "./permissions";
import type { Collection, Model, RelationField, SelectField } from "./types";

const noAuth = {
  features: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
};
const withAuth = {
  features: {
    auth: true,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
};

// A parent model used across resolveFields tests
const parent: Model = {
  name: "bird",
  pluralName: "birds",
  typeName: "Bird",
  tableName: "birds",
  displayName: "Bird",
  pluralDisplayName: "Birds",
  schemaName: "birdSchema",
  routeSegment: "birds",
  routesDir: "src/routes/(app)",
};

// ─── parseModel ──────────────────────────────────────────

describe("parseModel", () => {
  it("should parse a simple model", () => {
    const model = parseModel("birds", noAuth);
    expect(model).toEqual({
      name: "bird",
      pluralName: "birds",
      typeName: "Bird",
      tableName: "birds",
      displayName: "Bird",
      pluralDisplayName: "Birds",
      schemaName: "birdSchema",
      routeSegment: "birds",
      routesDir: "src/routes/(public)",
    });
  });

  it("should parse nested routes", () => {
    const model = parseModel("dashboard/admin-users", noAuth);
    expect(model).toEqual({
      name: "adminUser",
      pluralName: "adminUsers",
      typeName: "AdminUser",
      tableName: "admin_users",
      displayName: "Admin User",
      pluralDisplayName: "Admin Users",
      schemaName: "adminUserSchema",
      routeSegment: "dashboard/admin-users",
      routesDir: "src/routes/(public)",
    });
  });

  it("should use (app) routes dir when auth is enabled", () => {
    const model = parseModel("birds", withAuth);
    expect(model.routesDir).toBe("src/routes/(app)");
    expect(model.routeSegment).toBe("birds");
  });

  it("should use (public) routes dir when auth is disabled", () => {
    const model = parseModel("birds", noAuth);
    expect(model.routesDir).toBe("src/routes/(public)");
  });
});

// ─── modelPaths / modelUrls ──────────────────────────────

describe("modelPaths", () => {
  it("should derive correct paths for simple model", () => {
    const model = parseModel("birds", noAuth);
    expect(modelPaths(model)).toEqual({
      list: "src/routes/(public)/birds",
      new: "src/routes/(public)/birds/new",
      show: "src/routes/(public)/birds/[id]",
      edit: "src/routes/(public)/birds/[id]/edit",
    });
  });

  it("should derive correct paths for auth model", () => {
    const model = parseModel("birds", withAuth);
    expect(modelPaths(model)).toEqual({
      list: "src/routes/(app)/birds",
      new: "src/routes/(app)/birds/new",
      show: "src/routes/(app)/birds/[id]",
      edit: "src/routes/(app)/birds/[id]/edit",
    });
  });

  it("should derive correct paths for nested routes", () => {
    const model = parseModel("dashboard/admin-users", withAuth);
    expect(modelPaths(model)).toEqual({
      list: "src/routes/(app)/dashboard/admin-users",
      new: "src/routes/(app)/dashboard/admin-users/new",
      show: "src/routes/(app)/dashboard/admin-users/[id]",
      edit: "src/routes/(app)/dashboard/admin-users/[id]/edit",
    });
  });
});

describe("modelUrls", () => {
  it("should derive correct URLs", () => {
    const model = parseModel("birds", withAuth);
    expect(modelUrls(model)).toEqual({
      list: "/birds",
      new: "/birds/new",
      show: "/birds/[id]",
      edit: "/birds/[id]/edit",
    });
  });

  it("should derive correct URLs for nested routes", () => {
    const model = parseModel("dashboard/admin-users", noAuth);
    expect(modelUrls(model)).toEqual({
      list: "/dashboard/admin-users",
      new: "/dashboard/admin-users/new",
      show: "/dashboard/admin-users/[id]",
      edit: "/dashboard/admin-users/[id]/edit",
    });
  });
});

// ─── validateModelName ───────────────────────────────────

describe("validateModelName", () => {
  it("should throw for invalid model name starting with number", () => {
    expect(() => validateModelName("1abc")).toThrow(
      /Model path must start with a letter/,
    );
  });

  it("should not throw for valid model name", () => {
    expect(() => validateModelName("abc")).not.toThrow();
  });

  it("should allow names with a slash", () => {
    expect(() => validateModelName("abc/def")).not.toThrow();
  });
});

// ─── safeVarName ─────────────────────────────────────────

describe("safeVarName", () => {
  it("should return the same string if already safe", () => {
    expect(safeVarName("abc")).toBe("abc");
  });

  it("should return aliases for reserved words", () => {
    expect(safeVarName("class")).toBe("class_");
    expect(safeVarName("function")).toBe("fn");
  });

  it("should alias other reserved/special identifiers", () => {
    expect(safeVarName("default")).toBe("default_");
    expect(safeVarName("return")).toBe("return_");
    expect(safeVarName("delete")).toBe("delete_");
    expect(safeVarName("extends")).toBe("extends_");
    expect(safeVarName("super")).toBe("super_");
    expect(safeVarName("new")).toBe("new_");
    expect(safeVarName("type")).toBe("type_");
    expect(safeVarName("interface")).toBe("iface");
    expect(safeVarName("enum")).toBe("enum_");
    expect(safeVarName("await")).toBe("await_");
    expect(safeVarName("async")).toBe("async_");
    expect(safeVarName("arguments")).toBe("args");
    expect(safeVarName("constructor")).toBe("ctor");
    expect(safeVarName("null")).toBe("nullValue");
    expect(safeVarName("true")).toBe("trueValue");
    expect(safeVarName("false")).toBe("falseValue");
  });
});

// ─── splitFieldDef ───────────────────────────────────────

describe("splitFieldDef", () => {
  it("splits simple name:type", () => {
    expect(splitFieldDef("name:text")).toEqual(["name", "text"]);
  });

  it("returns type with required flag intact", () => {
    expect(splitFieldDef("status:select(draft,done)!")).toEqual([
      "status",
      "select(draft,done)!",
    ]);
  });

  it("keeps parentheses content intact", () => {
    expect(splitFieldDef("status:select(draft,done,archived)")).toEqual([
      "status",
      "select(draft,done,archived)",
    ]);
  });

  it("keeps quoted content with commas and colons intact (double quotes)", () => {
    expect(
      splitFieldDef(
        'status:select(draft:"In Progress",done:"Done, Really",todo:"To:Do")',
      ),
    ).toEqual([
      "status",
      'select(draft:"In Progress",done:"Done, Really",todo:"To:Do")',
    ]);
  });

  it("keeps quoted content with commas and colons intact (single quotes)", () => {
    expect(
      splitFieldDef(
        "status:select(draft:'In Progress',done:'Done, Really',todo:'To:Do')",
      ),
    ).toEqual([
      "status",
      "select(draft:'In Progress',done:'Done, Really',todo:'To:Do')",
    ]);
  });

  it("returns empty type when no colon is present", () => {
    expect(splitFieldDef("invalid")).toEqual(["invalid", ""]);
  });
});

// ─── parseSelectOptions ──────────────────────────────────

describe("parseSelectOptions", () => {
  it("should parse simple comma-separated values", () => {
    expect(parseSelectOptions("draft,done,archived")).toEqual([
      { value: "draft", label: "draft" },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ]);
  });

  it("should parse value:label pairs", () => {
    expect(parseSelectOptions("draft:Draft,done:Done")).toEqual([
      { value: "draft", label: "Draft" },
      { value: "done", label: "Done" },
    ]);
  });

  it("should handle quoted labels with commas and colons", () => {
    expect(
      parseSelectOptions(
        'draft:"In Progress",done:"Done",paused:"Paused, Waiting",todo:"To:Do"',
      ),
    ).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "paused", label: "Paused, Waiting" },
      { value: "todo", label: "To:Do" },
    ]);
  });

  it("should tolerate whitespace around values and labels", () => {
    expect(
      parseSelectOptions(' draft : "In Progress" , done : Done , archived '),
    ).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "archived", label: "archived" },
    ]);
  });
});

// ─── resolveFields ───────────────────────────────────────

describe("resolveFields", () => {
  const usersCollection: Collection = {
    id: "u1",
    name: "users",
    type: "base",
    fields: [],
  };

  it("should parse simple fields correctly", () => {
    const { fields } = resolveFields(
      ["name:text", "age:number", "isAdmin:bool"],
      parent,
      [usersCollection],
      noAuth,
    );
    expect(fields).toEqual([
      { type: "text", name: "name", title: "Name", required: false },
      { type: "number", name: "age", title: "Age", required: false },
      { type: "bool", name: "isAdmin", title: "Is Admin", required: false },
    ]);
  });

  it("should map all primitive types", () => {
    const inputs = [
      "name:text",
      "age:number",
      "isAdmin:bool",
      "birthdate:date",
      "email:email",
      "password:password",
      "website:url",
      "content:editor",
      "updatedAt:autodate",
      "choice:select",
      "avatar:file",
      "meta:json",
      "location:geoPoint",
    ];
    const { fields } = resolveFields(inputs, parent, [], noAuth);
    expect(fields.map((f) => f.type)).toEqual([
      "text",
      "number",
      "bool",
      "date",
      "email",
      "password",
      "url",
      "editor",
      "autodate",
      "select",
      "file",
      "json",
      "geoPoint",
    ]);
  });

  it("should map alias types to canonical types", () => {
    const inputs = [
      "title:string",
      "enabled:boolean",
      "count:int",
      "count2:integer",
      "price:float",
      "ratio:double",
      "amount:decimal",
      "publishedAt:datetime",
      "updatedAt:timestamp",
      "point:geopoint",
      "user:references",
    ];
    const { fields } = resolveFields(inputs, parent, [usersCollection], noAuth);
    expect(fields.map((f) => f.type)).toEqual([
      "text",
      "bool",
      "number",
      "number",
      "number",
      "number",
      "number",
      "date",
      "date",
      "geoPoint",
      "relation",
    ]);
  });

  it("should throw for invalid field name", () => {
    expect(() => resolveFields(["1abc:text"], parent, [], noAuth)).toThrow(
      /Invalid field name/,
    );
  });

  it("should throw for invalid field type", () => {
    expect(() => resolveFields(["title:unknown"], parent, [], noAuth)).toThrow(
      /Invalid field type/,
    );
  });

  it("should throw for invalid field format (missing type)", () => {
    expect(() => resolveFields(["noType"], parent, [], noAuth)).toThrow(
      /Invalid field format/,
    );
  });

  it("should set required on relation fields and keep relation metadata", () => {
    const { fields } = resolveFields(
      ["user:relation!", "users:relation!"],
      parent,
      [usersCollection],
      withAuth,
    );

    const userModel: Model = {
      name: "user",
      pluralName: "users",
      typeName: "User",
      tableName: "users",
      displayName: "User",
      pluralDisplayName: "Users",
      schemaName: "userSchema",
      routeSegment: "users",
      routesDir: "src/routes/(app)",
    };

    expect(fields).toEqual([
      {
        type: "relation",
        name: "user",
        title: "User",
        required: true,
        collectionId: "u1",
        maxSelect: 1,
        displayField: "id",
        relatedModel: userModel,
        singularRelationName: "birdUser",
        pluralRelationName: "birdUsers",
        isCurrentUser: false,
      },
      {
        type: "relation",
        name: "users",
        title: "Users",
        required: true,
        collectionId: "u1",
        maxSelect: 999,
        displayField: "id",
        relatedModel: userModel,
        singularRelationName: "birdUser",
        pluralRelationName: "birdUsers",
        isCurrentUser: false,
      },
    ]);
  });

  it("should error for relation field when collection does not exist", () => {
    expect(() => resolveFields(["user:relation"], parent, [], noAuth)).toThrow(
      /Invalid relation field/,
    );
  });

  it("should handle relation type with singular and plural field names", () => {
    const { fields } = resolveFields(
      ["user:relation", "users:relation"],
      parent,
      [usersCollection],
      withAuth,
    );
    expect(fields[0].type).toBe("relation");
    expect((fields[0] as RelationField).maxSelect).toBe(1);
    expect(fields[1].type).toBe("relation");
    expect((fields[1] as RelationField).maxSelect).toBe(999);
  });

  it("should infer relation when type equals collection name (plural)", () => {
    const usersWithTitle: Collection = {
      id: "u1",
      name: "users",
      type: "base",
      fields: [{ name: "title", type: "text" }],
    };

    const { fields } = resolveFields(
      ["owner:user", "owners:users"],
      parent,
      [usersWithTitle],
      withAuth,
    );

    expect(fields[0].type).toBe("relation");
    const ownerField = fields[0] as RelationField;
    expect(ownerField.collectionId).toBe("u1");
    expect(ownerField.displayField).toBe("title");
    expect(ownerField.maxSelect).toBe(1);
    expect(ownerField.singularRelationName).toBe("birdUser");
    expect(ownerField.pluralRelationName).toBe("birdUsers");

    expect(fields[1].type).toBe("relation");
    const ownersField = fields[1] as RelationField;
    expect(ownersField.maxSelect).toBe(999);
  });

  it("should parse select options with default label=value", () => {
    const { fields } = resolveFields(
      ["status:select(draft,done,archived)"],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.type).toBe("select");
    expect(field.options).toEqual([
      { value: "draft", label: "draft" },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ]);
  });

  it("should parse select options as value:label pairs", () => {
    const { fields } = resolveFields(
      ["status:select(draft:Draft,done:Done)"],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.options).toEqual([
      { value: "draft", label: "Draft" },
      { value: "done", label: "Done" },
    ]);
  });

  it("should parse quoted labels and preserve commas/colons inside quotes", () => {
    const { fields } = resolveFields(
      [
        'status:select(draft:"In Progress",done:"Done",paused:"Paused, Waiting",todo:"To:Do")',
      ],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.options).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "paused", label: "Paused, Waiting" },
      { value: "todo", label: "To:Do" },
    ]);
  });

  it("should tolerate whitespace around select values and labels", () => {
    const { fields } = resolveFields(
      ['status:select( draft : "In Progress" , done : Done , archived )'],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.options).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "archived", label: "archived" },
    ]);
  });

  it("should set required when select has trailing !", () => {
    const { fields } = resolveFields(
      ['status:select(draft:"In Progress",done:"Done")!'],
      parent,
      [],
      noAuth,
    );
    expect(fields[0].required).toBe(true);
    expect(fields[0].type).toBe("select");
  });

  it("should handle autodate fields with create/update", () => {
    const { fields } = resolveFields(
      ["createdAt:autodate", "updatedAt:autodate"],
      parent,
      [],
      noAuth,
    );
    expect(fields[0]).toEqual({
      type: "autodate",
      name: "createdAt",
      title: "Created At",
      required: false,
      onCreate: true,
      onUpdate: false,
    });
    expect(fields[1]).toEqual({
      type: "autodate",
      name: "updatedAt",
      title: "Updated At",
      required: false,
      onCreate: false,
      onUpdate: true,
    });
  });

  it("should throw for invalid autodate field name", () => {
    expect(() =>
      resolveFields(["randomDate:autodate"], parent, [], noAuth),
    ).toThrow(/Invalid autodate field/);
  });

  it("should handle file and files via singular/plural inference", () => {
    const { fields } = resolveFields(
      ["avatar:file", "photos:file"],
      parent,
      [],
      noAuth,
    );
    expect(fields[0].type).toBe("file");
    expect((fields[0] as any).maxSelect).toBe(1);
    expect(fields[1].type).toBe("file");
    expect((fields[1] as any).maxSelect).toBe(99);
  });

  it("should handle 'files' alias type", () => {
    const { fields } = resolveFields(["photos:files"], parent, [], noAuth);
    expect(fields[0].type).toBe("file");
    expect((fields[0] as any).maxSelect).toBe(99);
  });

  it("should handle select maxSelect via singular/plural field name", () => {
    const { fields } = resolveFields(
      ["color:select(red,blue)", "colors:select(red,blue)"],
      parent,
      [],
      noAuth,
    );
    expect((fields[0] as SelectField).maxSelect).toBe(1);
    expect((fields[1] as SelectField).maxSelect).toBe(99);
  });

  it("should generate auth rule when auth is enabled", () => {
    const { auth } = resolveFields(
      ["name:text"],
      parent,
      [usersCollection],
      withAuth,
    );
    expect(auth).toBeDefined();
    expect(auth!.rule).toContain("@request.auth.id");
  });

  it("should not generate auth rule when auth is disabled", () => {
    const { auth } = resolveFields(["name:text"], parent, [], noAuth);
    expect(auth).toBeUndefined();
  });

  it("should handle current_user when auth is enabled", () => {
    const { fields } = resolveFields(
      ["author:current_user"],
      parent,
      [usersCollection],
      withAuth,
    );
    expect(fields[0].type).toBe("relation");
    const field = fields[0] as RelationField;
    expect(field.isCurrentUser).toBe(true);
    expect(field.collectionId).toBe("u1");
    expect(field.maxSelect).toBe(1);
  });
});

// ─── pickDisplayField ────────────────────────────────────

describe("pickDisplayField", () => {
  it("should pick name over email", () => {
    const fields = [
      { name: "age", type: "text" },
      { name: "email", type: "text" },
      { name: "name", type: "text" },
    ];
    expect(pickDisplayField(fields)).toBe("name");
  });

  it("should pick name over full_name", () => {
    const fields = [
      { name: "full_name", type: "text" },
      { name: "name", type: "text" },
      { name: "label", type: "text" },
    ];
    expect(pickDisplayField(fields)).toBe("name");
  });

  it("should fall back to id when no candidates match", () => {
    const fields = [{ name: "foo", type: "text" }];
    expect(pickDisplayField(fields)).toBe("id");
  });
});

// ─── collectionIdMap ─────────────────────────────────────

describe("collectionIdMap", () => {
  it("should return correct id map", () => {
    const collections: Collection[] = [
      { id: "u1", name: "users", type: "base", fields: [] },
    ];
    expect(collectionIdMap(collections)).toEqual({ users: "u1" });
  });
});

// ─── collectionDisplayFieldMap ───────────────────────────

describe("collectionDisplayFieldMap", () => {
  it("should fall back to id when no display field candidates", () => {
    const collections: Collection[] = [
      { id: "u1", name: "users", type: "base", fields: [] },
    ];
    expect(collectionDisplayFieldMap(collections)).toEqual({ users: "id" });
  });

  it("should pick title as display field", () => {
    const collections: Collection[] = [
      {
        id: "u1",
        name: "users",
        type: "base",
        fields: [{ name: "title", type: "text" }],
      },
    ];
    expect(collectionDisplayFieldMap(collections)).toEqual({
      users: "title",
    });
  });
});

// ─── collectionNames ─────────────────────────────────────

describe("collectionNames", () => {
  it("should exclude system collections", () => {
    const collections: Collection[] = [
      { id: "1", name: "users", type: "base", fields: [] },
      { id: "2", name: "_internal", type: "base", fields: [] },
    ];
    expect(collectionNames(collections)).toEqual(["users"]);
  });
});

// ─── generateAuthRule ────────────────────────────────────

describe("generateAuthRule", () => {
  it("should return self-rule for auth collection", () => {
    const schema: Collection[] = [
      { id: "u1", name: "users", type: "auth", fields: [] },
    ];
    const result = generateAuthRule(schema, "users");
    expect(result.rule).toBe("@request.auth.id = id");
    expect(result.operator).toBe("=");
  });

  it("should find path through relation to users", () => {
    const schema: Collection[] = [
      { id: "u1", name: "users", type: "auth", fields: [] },
      {
        id: "p1",
        name: "posts",
        type: "base",
        fields: [
          {
            name: "author",
            type: "relation",
            collectionId: "u1",
            maxSelect: 1,
          },
        ],
      },
    ];
    const result = generateAuthRule(schema, "posts");
    expect(result.rule).toBe("@request.auth.id = author.id");
    expect(result.ownershipChainFields).toEqual(["author"]);
    expect(result.operator).toBe("=");
  });

  it("should fall back to authenticated-only when no path to auth", () => {
    const schema: Collection[] = [
      { id: "p1", name: "posts", type: "base", fields: [] },
    ];
    const result = generateAuthRule(schema, "posts");
    expect(result.rule).toBe('@request.auth.id != ""');
  });
});
