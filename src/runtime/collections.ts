import { readFileSync } from "node:fs";
import type PocketBase from "pocketbase";
import type { CollectionModel } from "pocketbase";
import type {
  CollectionFieldSpec,
  CollectionFieldsPatch,
  CollectionRulesPatch,
  CollectionSpec,
  File,
  Options,
} from "../core/types";
import { InvalidArgumentError } from "../core/errors";
import { getLogger, NOOP_LOGGER, type Logger } from "../core/logger";
import { languageFromPath } from "../core/util";
import { getMigrationFile, migrationDelay, withPocketbase } from "./pocketbase";

interface PocketBaseCollectionCreateError {
  response?: {
    data?: {
      name?: {
        code?: string;
      };
    };
  };
  message?: string;
}

function isCollectionAlreadyExistsError(
  error: PocketBaseCollectionCreateError,
): boolean {
  console.log(JSON.stringify(error, null, 2));
  if (error.response?.data?.name?.code === "validation_not_unique") {
    return true;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("already exists") || message.includes("must be unique")
  );
}

type CollectionCreateInput = Parameters<PocketBase["collections"]["create"]>[0];

export interface CreateCollectionResult {
  collection: CollectionModel;
  created: boolean;
}

/**
 * Idempotent wrapper around `pb.collections.create`. If the collection already
 * exists, logs and returns the existing model with `created: false` so callers
 * can skip work tied to a fresh create (e.g. appending a newly-generated
 * migration file to the result).
 */
export async function createCollectionIdempotent(
  pb: PocketBase,
  spec: CollectionCreateInput,
  logger: Logger = NOOP_LOGGER,
): Promise<CreateCollectionResult> {
  const name = (spec as { name: string }).name;
  try {
    const collection = await pb.collections.create(spec);
    return { collection, created: true };
  } catch (error) {
    if (
      !isCollectionAlreadyExistsError(error as PocketBaseCollectionCreateError)
    ) {
      throw error;
    }
    logger.info(`Collection "${name}" already exists, skipping`);
    const collection = await pb.collections.getOne(name);
    return { collection, created: false };
  }
}

function rulePayloadFromPatch(
  patch: CollectionRulesPatch,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.listRule !== undefined) payload.listRule = patch.listRule;
  if (patch.viewRule !== undefined) payload.viewRule = patch.viewRule;
  if (patch.createRule !== undefined) payload.createRule = patch.createRule;
  if (patch.updateRule !== undefined) payload.updateRule = patch.updateRule;
  if (patch.deleteRule !== undefined) payload.deleteRule = patch.deleteRule;
  return payload;
}

/**
 * Applies API rule updates in array order. Call after all referenced collections exist.
 * Collects migration files produced by each update when `options` is provided.
 */
export async function applyCollectionRulePatches(
  pb: {
    collections: {
      getFirstListItem: (filter: string) => Promise<{ id: string }>;
      update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
    };
  },
  patches: CollectionRulesPatch[],
  options?: Options,
  logger: Logger = NOOP_LOGGER,
): Promise<File[]> {
  const migrations: File[] = [];

  for (const patch of patches) {
    const escaped = patch.collectionName.replace(/'/g, "''");
    const col = await pb.collections.getFirstListItem(`name='${escaped}'`);
    logger.info(`Updating rules on collection "${patch.collectionName}"`);
    await pb.collections.update(col.id, rulePayloadFromPatch(patch));
    await migrationDelay();

    if (options) {
      const migrationFile = getMigrationFile(
        patch.collectionName,
        "updated",
        options,
      );
      if (migrationFile) {
        migrations.push({
          path: migrationFile,
          language: languageFromPath(migrationFile),
          content: readFileSync(migrationFile, "utf8"),
          status: "success",
        });
      }
    }
  }

  return migrations;
}

function applyFieldChanges(
  existing: CollectionFieldSpec[],
  patch: CollectionFieldsPatch,
): CollectionFieldSpec[] {
  const fields = existing.map((field) => ({ ...field }));

  for (const change of patch.changes) {
    if (change.op === "add") {
      if (fields.some((f) => f.name === change.field.name)) {
        throw new InvalidArgumentError(
          `Field "${change.field.name}" already exists on collection "${patch.collectionName}"`,
        );
      }
      fields.push(change.field);
      continue;
    }
    if (change.op === "remove") {
      const index = fields.findIndex((f) => f.name === change.fieldName);
      if (index === -1) {
        throw new InvalidArgumentError(
          `Field "${change.fieldName}" does not exist on collection "${patch.collectionName}"`,
        );
      }
      fields.splice(index, 1);
      continue;
    }
    if (change.op === "rename") {
      const field = fields.find((f) => f.name === change.from);
      if (!field) {
        throw new InvalidArgumentError(
          `Field "${change.from}" does not exist on collection "${patch.collectionName}"`,
        );
      }
      if (fields.some((f) => f.name === change.to)) {
        throw new InvalidArgumentError(
          `Field "${change.to}" already exists on collection "${patch.collectionName}"`,
        );
      }
      field.name = change.to;
      continue;
    }
  }

  return fields;
}

export async function applyCollectionFieldsPatches(
  pb: {
    collections: {
      getOne: (
        name: string,
      ) => Promise<{ id: string; fields: CollectionFieldSpec[] }>;
      update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
    };
  },
  patches: CollectionFieldsPatch[],
  options: Options,
  logger: Logger = NOOP_LOGGER,
): Promise<File[]> {
  const migrations: File[] = [];

  for (const patch of patches) {
    const collection = await pb.collections.getOne(patch.collectionName);
    const newFields = applyFieldChanges(collection.fields, patch);
    logger.info(`Updating fields on collection "${patch.collectionName}"`);
    await pb.collections.update(collection.id, { fields: newFields });
    await migrationDelay();

    const migrationFile = getMigrationFile(
      patch.collectionName,
      "updated",
      options,
    );
    if (!migrationFile) continue;

    migrations.push({
      path: migrationFile,
      language: languageFromPath(migrationFile),
      content: readFileSync(migrationFile, "utf8"),
      status: "success",
    });
  }

  return migrations;
}

export async function createCollections(
  collections: CollectionSpec[],
  options: Options,
): Promise<File[]> {
  if (collections.length === 0) {
    return [];
  }

  const migrations: File[] = [];
  const logger = getLogger(options);

  await withPocketbase(options.root, async (pb) => {
    for (const collection of collections) {
      logger.info(`Creating collection "${collection.name}"`);
      const { created } = await createCollectionIdempotent(
        pb,
        collection,
        logger,
      );
      if (!created) continue;
      await migrationDelay();

      const migrationFile = getMigrationFile(
        collection.name,
        "created",
        options,
      );
      if (!migrationFile) {
        continue;
      }

      migrations.push({
        path: migrationFile,
        language: languageFromPath(migrationFile),
        content: readFileSync(migrationFile, "utf8"),
        status: "success",
      });
    }
  });

  return migrations;
}
