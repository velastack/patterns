import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getMigrationFile, migrationDelay, withPocketbase } from "../../../runtime/pocketbase";
import { modifyHooksServer } from "./modifies/hooks.server";
import { modifyNavUser } from "./modifies/nav-user.svelte";

export async function generate(options: Options) {
  const creates: File[] = [];

  await withPocketbase(options.root, async (pb) => {
    const userCollection = await pb.collections.getOne("users");

    await pb.collections.create({
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
    await migrationDelay();

    const migrationFile = getMigrationFile("api_keys", "created", options);
    if (migrationFile) {
      creates.push({
        path: migrationFile,
        language: "ts",
        content: fs.readFileSync(migrationFile, "utf8"),
      });
    }
  });

  const modifies: File[] = [];

  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  if (fs.existsSync(hooksServerPath)) {
    modifyHooksServer(hooksServerPath);
    modifies.push({
      path: hooksServerPath,
      language: "ts",
      content: fs.readFileSync(hooksServerPath, "utf8"),
    });
  }

  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  if (modifyNavUser(navUserPath)) {
    modifies.push({
      path: navUserPath,
      language: "svelte",
      content: fs.readFileSync(navUserPath, "utf8"),
    });
  }

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
  } satisfies Result;
}
