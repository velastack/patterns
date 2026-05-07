export interface Model {
  name: string;
  pluralName: string;
  typeName: string;
  tableName: string;
  displayName: string;
  pluralDisplayName: string;
  schemaName: string;
}

export type RouteKind = "form" | "scaffold";

export interface RouteInfo {
  fileBase: string;
  urlBase: string;
  dynamicParams: string[];
}

export interface ScaffoldFilePaths {
  list: string;
  new: string;
  show: string;
  edit: string;
}

export interface ScaffoldUrls {
  list: string;
  new: string;
  show: string;
  edit: string;
}

export const validTypes = [
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
  "relation",
] as const;

export type SimpleFieldType =
  | "text"
  | "number"
  | "bool"
  | "date"
  | "email"
  | "password"
  | "url"
  | "editor"
  | "json"
  | "geoPoint";

export type FieldType = (typeof validTypes)[number];

export interface FieldBase {
  name: string;
  title: string;
  required: boolean;
}

export interface SimpleField extends FieldBase {
  type: SimpleFieldType;
}

export interface AutodateField extends FieldBase {
  type: "autodate";
  onCreate: boolean;
  onUpdate: boolean;
}

export interface SelectField extends FieldBase {
  type: "select";
  maxSelect: number;
  options: Array<{ label: string; value: string }>;
}

export interface FileField extends FieldBase {
  type: "file";
  maxSelect: number;
}

export interface RelationField extends FieldBase {
  type: "relation";
  collectionId: string;
  maxSelect: number;
  displayField: string;
  relatedModel: Model;
  singularRelationName: string;
  pluralRelationName: string;
  isCurrentUser: boolean;
  isCurrentTeam: boolean;
}

export type Field =
  | SimpleField
  | AutodateField
  | SelectField
  | FileField
  | RelationField;

export interface CollectionField {
  name: string;
  type: string;
  collectionId?: string;
  maxSelect?: number;
}

export interface Collection {
  id: string;
  name: string;
  type: "base" | "auth" | "view";
  fields: CollectionField[];
}

export interface OwnershipResult {
  rule: string;
  ownershipChainCollections: string[];
  ownershipChainFields: string[];
  operator: "=" | "?=";
}
