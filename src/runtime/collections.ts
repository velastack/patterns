import { readFileSync } from "node:fs";
import type { CollectionSpec, File, Options } from "../core/types";
import { languageFromPath } from "../core/util";
import { getMigrationFile, withPocketbase } from "./pocketbase";

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
