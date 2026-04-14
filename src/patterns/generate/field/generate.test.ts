import { describe, expect, it } from "vitest";
import type { Model } from "../../../parse";
import { renderDisplayField, renderField, selectFieldLabelMap } from "./index";

const model: Model = {
  name: "user",
  pluralName: "users",
  typeName: "User",
  tableName: "users",
  displayName: "User",
  pluralDisplayName: "Users",
  schemaName: "userSchema",
  routeSegment: "users",
  routesDir: "src/routes",
};

const relatedModel: Model = {
  name: "hotelOwner",
  pluralName: "hotelOwners",
  typeName: "HotelOwner",
  tableName: "hotel_owners",
  displayName: "Hotel owner",
  pluralDisplayName: "Hotel owners",
  schemaName: "hotelOwnerSchema",
  routeSegment: "hotel-owners",
  routesDir: "src/routes",
};

function compact(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

describe("renderField", () => {
  it("renders text field with required and extra input props", () => {
    const field = renderField({
      name: "name",
      type: "text",
      title: "Name",
      required: true,
      labelAside: "<a href=\"/help\">Help</a>",
      inputProps: { placeholder: "Enter name", autocomplete: "off" },
    });

    expect(compact(field)).toContain(
      compact(
        `<div class="flex justify-between">
          <Form.Label>Name</Form.Label>
          <a href="/help">Help</a>
        </div>`,
      ),
    );
    expect(compact(field)).toContain(
      '<Input {...props} type="text" bind:value={$formData.name} required placeholder="Enter name" autocomplete="off" />',
    );
  });

  it("renders bool field with checkbox before label", () => {
    const field = renderField({
      name: "active",
      type: "bool",
      title: "Active",
      required: true,
    });

    expect(field).toContain('class="col-span-1 flex items-start space-x-2"');
    expect(field.indexOf("<Checkbox")).toBeLessThan(field.indexOf("<Form.Label>Active"));
  });

  it("renders autodate as readonly value input", () => {
    const field = renderField({
      name: "created",
      type: "autodate",
      title: "Created",
      required: true,
      onCreate: true,
      onUpdate: true,
    });

    expect(field).toContain('type="text" value={$formData.created}');
    expect(field).toContain("readonly");
    expect(field).not.toContain("bind:value={$formData.created}");
  });

  it("renders select options and label map usage", () => {
    const field = renderField({
      name: "role",
      type: "select",
      title: "Role",
      required: true,
      maxSelect: 1,
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
      ],
    });

    expect(field).toContain('<MultiSelect.Field {form} type="single" name="role" required');
    expect(field).toContain('<MultiSelect.Item value="admin" label={roleLabels["admin"].label} />');
    expect(field).toContain("<Command.Empty>No options found</Command.Empty>");
  });

  it("renders relation field with model-driven placeholder and search copy", () => {
    const field = renderField({
      name: "owner",
      type: "relation",
      title: "Owner",
      required: true,
      collectionId: "hotel_owners",
      maxSelect: 1,
      displayField: "name",
      relatedModel,
      singularRelationName: "owner",
      pluralRelationName: "owners",
      isCurrentUser: false,
    });

    expect(field).toContain('placeholder="Select hotel owner"');
    expect(field).toContain('placeholder="Search hotel owners..."');
    expect(field).toContain("<Command.Empty>No hotel owners found</Command.Empty>");
  });
});

describe("renderDisplayField", () => {
  it("renders optional autodate with conditional guard", () => {
    const display = renderDisplayField(model, {
      name: "created",
      type: "autodate",
      title: "Created",
      required: false,
      onCreate: true,
      onUpdate: true,
    });

    expect(display).toContain("{#if data.user.created}");
    expect(display).toContain("{new Date(data.user.created).toLocaleDateString()}");
  });

  it("renders select display for single optional and multi select", () => {
    const singleDisplay = renderDisplayField(model, {
      name: "role",
      type: "select",
      title: "Role",
      required: false,
      maxSelect: 1,
      options: [{ label: "Admin", value: "admin" }],
    });
    expect(singleDisplay).toContain("{#if data.user.role}");
    expect(singleDisplay).toContain("{roleLabels[data.user.role].label}");

    const multiDisplay = renderDisplayField(model, {
      name: "roles",
      type: "select",
      title: "Roles",
      required: true,
      maxSelect: 2,
      options: [{ label: "Admin", value: "admin" }],
    });
    expect(multiDisplay).toContain("{#each data.user.roles as roles}");
    expect(multiDisplay).toContain("{rolesLabels[roles].label}");
  });

  it("renders file display for single and multiple modes", () => {
    const singleDisplay = renderDisplayField(model, {
      name: "avatar",
      type: "file",
      title: "Avatar",
      required: true,
      maxSelect: 1,
    });
    expect(singleDisplay).toContain('{#if [".jpg", ".png", ".jpeg", ".webp", ".gif"].some((ext) => data.user.avatar?.endsWith(ext))}');
    expect(singleDisplay).toContain('<FileIcon class="w-4 h-4" />');
    expect(singleDisplay).toContain('src="/api/files/{data.user.collectionId}/{data.user.id}/{data.user.avatar}"');

    const multiDisplay = renderDisplayField(model, {
      name: "avatars",
      type: "file",
      title: "Avatars",
      required: true,
      maxSelect: 3,
    });
    expect(multiDisplay).toContain("{#each data.user.avatars as filename}");
    expect(multiDisplay).toContain("filename.endsWith(ext)");
  });

  it("renders relation display for single and multiple expand paths", () => {
    const singleDisplay = renderDisplayField(model, {
      name: "owner",
      type: "relation",
      title: "Owner",
      required: true,
      collectionId: "hotel_owners",
      maxSelect: 1,
      displayField: "name",
      relatedModel,
      singularRelationName: "hotelOwner",
      pluralRelationName: "hotelOwners",
      isCurrentUser: false,
    });
    expect(singleDisplay).toContain("{#if data.user.expand?.owner}");
    expect(singleDisplay).toContain('href="/hotel-owners/{data.user.expand?.owner.id}"');

    const multiDisplay = renderDisplayField(model, {
      name: "owners",
      type: "relation",
      title: "Owners",
      required: true,
      collectionId: "hotel_owners",
      maxSelect: 10,
      displayField: "name",
      relatedModel,
      singularRelationName: "hotelOwner",
      pluralRelationName: "hotelOwners",
      isCurrentUser: false,
    });
    expect(multiDisplay).toContain("{#each data.user.expand?.owners ?? [] as hotelOwner}");
    expect(multiDisplay).toContain("{hotelOwner.name}");
  });

  it("renders optional geopoint display with lazy leaflet import", () => {
    const display = renderDisplayField(model, {
      name: "location",
      type: "geoPoint",
      title: "Location",
      required: false,
    });

    expect(display).toContain("{#if data.user.location}");
    expect(display).toContain('{#await import("$lib/components/ui/leaflet/leaflet.svelte")}');
    expect(display).toContain("{data.user.location?.lat.toFixed(6)}, {data.user.location?.lon.toFixed(6)}");
  });
});

describe("selectFieldLabelMap", () => {
  it("builds label map constants for select fields", () => {
    const map = selectFieldLabelMap({
      name: "role",
      type: "select",
      title: "Role",
      required: true,
      maxSelect: 1,
      options: [
        { label: "Admin", value: "admin" },
        { label: "User", value: "user" },
      ],
    });

    expect(map).toContain("const roleLabels =");
    expect(map).toContain('"admin": {');
    expect(map).toContain('label: "Admin"');
  });
});
