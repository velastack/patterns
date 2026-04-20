import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";
import { createCollectionIdempotent } from "../../../runtime/collections";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyHooksServer } from "./modifies/hooks.server";
import { modifyNavUser } from "./modifies/nav-user.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const creates: File[] = [];

  await withPocketbase(options.root, async (pb) => {
    const userCollection = await pb.collections.getOne("users");

    logger.info("Creating api_keys collection");
    const apiKeysResult = await createCollectionIdempotent(pb, {
      listRule: "@request.auth.id = user.id",
      viewRule: "@request.auth.id = user.id",
      createRule: "@request.auth.id = user.id",
      updateRule: "@request.auth.id = user.id",
      deleteRule: "@request.auth.id = user.id",
      name: "api_keys",
      type: "base",
      fields: [
        {
          collectionId: userCollection.id,
          maxSelect: 1,
          name: "user",
          type: "relation",
        },
        {
          name: "key_hash",
          type: "text",
        },
        {
          name: "label",
          type: "text",
        },
        {
          name: "last_used",
          type: "date",
        },
        {
          name: "created",
          onCreate: true,
          onUpdate: false,
          type: "autodate",
        },
        {
          name: "updated",
          onCreate: true,
          onUpdate: true,
          type: "autodate",
        },
      ],
    });
    if (apiKeysResult.created) {
      await migrationDelay();

      const migrationFile = getMigrationFile("api_keys", "created", options);
      if (migrationFile) {
        creates.push({
          path: migrationFile,
          language: "ts",
          content: fs.readFileSync(migrationFile, "utf8"),
          status: "success",
        });
      }
    }
  });

  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(hooksServerPath, modifyHooksServer(hooksServerPath)),
  );

  logger.info("Modifying nav-user");
  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  pushResult(modifyOutcomeToFile(navUserPath, modifyNavUser(navUserPath)));

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
  } satisfies Result;
}
