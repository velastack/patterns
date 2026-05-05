import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { languageFromPath } from "../../../core/util";
import {
  applyCollectionRulePatches,
  createCollectionIdempotent,
} from "../../../runtime/collections";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyAppLayout } from "./modifies/modify-app-layout";
import { NOTIFICATION_RULE_PATCHES } from "./runtime/pocketbase";

async function pushMigrationCreates(
  creates: File[],
  collectionName: string,
  options: Options,
  created = true,
) {
  if (!created) return;
  await migrationDelay();
  const migrationFile = getMigrationFile(collectionName, "created", options);
  if (!migrationFile) return;
  creates.push({
    path: migrationFile,
    language: languageFromPath(migrationFile),
    content: fs.readFileSync(migrationFile, "utf8"),
    status: "success",
  });
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const creates: File[] = [];

  await withPocketbase(options.root, async (pb) => {
    const userCollection = await pb.collections.getOne("users");
    const create = (spec: Parameters<typeof createCollectionIdempotent>[1]) =>
      createCollectionIdempotent(pb, spec, logger);

    logger.info("Creating notifications collection");
    const result = await create({
      name: "notifications",
      type: "base",
      fields: [
        {
          name: "id",
          type: "text",
          primaryKey: true,
          autogeneratePattern: "[a-z0-9]{15}",
          max: 15,
          min: 15,
          pattern: "^[a-z0-9]+$",
          required: true,
        },
        {
          name: "user",
          type: "relation",
          cascadeDelete: true,
          collectionId: userCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: true,
        },
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "body",
          type: "text",
        },
        {
          name: "read",
          type: "bool",
        },
        {
          name: "created",
          type: "autodate",
          onCreate: true,
          onUpdate: false,
        },
        {
          name: "updated",
          type: "autodate",
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        "CREATE INDEX `idx_notifications_user_read_created` ON `notifications` (`user`, `read`, `created` DESC)",
      ],
    });
    await pushMigrationCreates(
      creates,
      "notifications",
      options,
      result.created,
    );

    logger.info("Applying notifications rule patches");
    const ruleMigrations = await applyCollectionRulePatches(
      pb,
      NOTIFICATION_RULE_PATCHES,
      options,
      logger,
    );
    creates.push(...ruleMigrations);
  });

  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying (app) +layout.svelte");
  const appLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appLayoutPath, modifyAppLayout(appLayoutPath)),
  );

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
