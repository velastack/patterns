import { readFileSync } from "node:fs";
import type {
  CollectionRulesPatch,
  CollectionSpec,
  File,
  Options,
} from "../core/types";
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
  if (error.response?.data?.name?.code === "validation_not_unique") {
    return true;
  }

  const message = error.message?.toLowerCase() ?? "";
  return message.includes("already exists") || message.includes("must be unique");
}

function rulePayloadFromPatch(patch: CollectionRulesPatch): Record<string, unknown> {
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
): Promise<File[]> {
  const migrations: File[] = [];

  for (const patch of patches) {
    const escaped = patch.collectionName.replace(/'/g, "''");
    const col = await pb.collections.getFirstListItem(`name='${escaped}'`);
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
        });
      }
    }
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

  await withPocketbase(options.root, async (pb) => {
    for (const collection of collections) {
      try {
        await pb.collections.create(collection);
      } catch (error) {
        if (
          isCollectionAlreadyExistsError(
            error as PocketBaseCollectionCreateError,
          )
        ) {
          throw new Error(
            `Collection "${collection.name}" already exists. Choose a different model name or remove the existing collection first.`,
          );
        }
        throw error;
      }
      await migrationDelay();

      const migrationFile = getMigrationFile(collection.name, "created", options);
      if (!migrationFile) {
        continue;
      }

      migrations.push({
        path: migrationFile,
        language: languageFromPath(migrationFile),
        content: readFileSync(migrationFile, "utf8"),
      });
    }
  });

  return migrations;
}
