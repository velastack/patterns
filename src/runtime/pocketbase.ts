import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import PocketBase from "pocketbase";
import { detect } from "package-manager-detector";
import { resolveCommand } from "package-manager-detector/commands";
import spawn from "cross-spawn";
import { freePort, waitForPort, waitForHealth } from "./net";
import type { Options } from "../core/types";
import {
  DATA_DIR,
  MIGRATIONS_DIR,
  POCKETBASE_BIN_ENV,
} from "../core/constants";

/**
 * PocketBase names migration files with a 1-second-resolution Unix timestamp
 * (e.g. `1776099881_created_users.js`). Two schema operations issued in the
 * same wall-clock second produce files that sort alphabetically by their
 * action/collection suffix — which reverses the intended order whenever a
 * later migration depends on an earlier one. Wait out the full second between
 * migration-producing calls so the timestamps stay distinct.
 */
const MIGRATION_DELAY_MS = 1100;

export function migrationDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MIGRATION_DELAY_MS));
}

export function getMigrationFile(
  collectionName: string,
  action: "created" | "deleted" | "updated",
  options: Options,
): string | undefined {
  const ending = `${action}_${collectionName}.js`;

  // find last file with ending in migrations dir
  const migrationFiles = readdirSync(
    path.join(options.root, MIGRATIONS_DIR),
  ).filter((file) => file.endsWith(ending));

  const migrationFile = migrationFiles.sort().pop();

  if (!migrationFile) {
    return undefined;
  }

  return path.join(options.root, MIGRATIONS_DIR, migrationFile);
}

export function getPocketbaseMetadata(cwd: string): {
  pocketbaseUrl: string;
  vitePort: number;
} | null {
  const metadataPath = path.join(
    cwd,
    "node_modules",
    ".vite",
    "_pocketbase_metadata.json",
  );
  if (existsSync(metadataPath)) {
    return JSON.parse(readFileSync(metadataPath, "utf8"));
  }
  return null;
}

export async function authWithRetries(
  pb: PocketBase,
  email: string,
  password: string,
) {
  // Retry authentication up to 3 times with 100ms backoff
  let authSuccess = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await pb.collection("_superusers").authWithPassword(email, password);
      authSuccess = true;
      break;
    } catch {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  if (!authSuccess) {
    throw new Error(
      "Failed to authenticate with PocketBase. Check your superuser credentials.",
    );
  }
}

/**
 * The command that runs PocketBase with the given arguments (`serve --dir
 * ...`).
 *
 * With `VELA_POCKETBASE_BIN` (`POCKETBASE_BIN_ENV`) set, that binary itself:
 * the caller has resolved it, and nothing about the project's package manager
 * is consulted. `pocketbase-server`'s own bin only forwards its arguments to
 * the binary, so they are the same either way. The value has to be an
 * absolute path to a file that exists; anything else is an error rather than
 * a quiet fall back to the package manager, since whoever set it meant it.
 * Unset or empty, the server is started as before, through the project's
 * package manager (`npx --yes pocketbase-server ...`, `pnpm dlx ...`), which
 * the integration harness and direct callers of this library rely on.
 */
export async function pocketbaseCommand(
  cwd: string,
  serverArgs: string[],
  env: Record<string, string | undefined> = process.env,
): Promise<{ command: string; args: string[] }> {
  const bin = env[POCKETBASE_BIN_ENV];
  if (bin) {
    if (!path.isAbsolute(bin)) {
      throw new Error(
        `${POCKETBASE_BIN_ENV} must be an absolute path to the PocketBase binary; it is "${bin}".`,
      );
    }
    if (!existsSync(bin)) {
      throw new Error(
        `${POCKETBASE_BIN_ENV} points at ${bin}, which does not exist.`,
      );
    }
    return { command: bin, args: [...serverArgs] };
  }

  const packageManager = (await detect({ cwd }))?.name ?? "npm";
  const { command, args } = resolveCommand(packageManager, "execute", [
    "pocketbase-server",
    ...serverArgs,
  ])!;

  // adding --yes as the first parameter helps avoiding the "Need to install the following packages:" message
  if (packageManager === "npm") args.unshift("--yes");

  return { command, args };
}

export async function withPocketbase(
  cwd: string,
  fn: (pb: PocketBase) => Promise<void>,
) {
  const dir = path.join(cwd, DATA_DIR);
  const migrationsDir = path.join(cwd, MIGRATIONS_DIR);
  const host = "localhost";

  if (!existsSync(dir)) {
    throw new Error("PocketBase data directory does not exist");
  }

  // First check if the server is already running by reading node_modules/.vite/_pocketbase_metadata.json
  const metadata = getPocketbaseMetadata(cwd);
  if (metadata) {
    if (metadata.pocketbaseUrl) {
      const pb = new PocketBase(metadata.pocketbaseUrl);
      await authWithRetries(
        pb,
        process.env.POCKETBASE_SUPERUSER_EMAIL!,
        process.env.POCKETBASE_SUPERUSER_PASSWORD!,
      );
      await fn(pb);
      return;
    }
  }

  const port = await freePort(host);
  const { command, args } = await pocketbaseCommand(cwd, [
    "serve",
    "--dir",
    dir,
    "--migrationsDir",
    migrationsDir,
    "--http",
    `${host}:${port}`,
  ]);

  // Start the PocketBase server process. A package manager wrapper (`npx`)
  // spawns the real binary as a grandchild; put the tree in its own process
  // group so it can be killed as a whole, otherwise `pocketbase serve` outlives
  // us and keeps the data directory open.
  const detached = process.platform !== "win32";
  const serverProcess = spawn(command, args, {
    cwd,
    stdio: "ignore",
    detached,
  });

  // A wrapper that dies before the server listens (missing binary, bad
  // arguments) would otherwise only surface as a port timeout a minute later.
  const exited = new Promise<never>((_, reject) => {
    serverProcess.once("exit", (code, signal) => {
      reject(
        new Error(
          `PocketBase (${command}) exited before listening on ${host}:${port} (${signal ?? `code ${code}`})`,
        ),
      );
    });
    serverProcess.once("error", reject);
  });

  try {
    // Wait for the server to be ready
    await Promise.race([
      (async () => {
        await waitForPort(port, host);
        await waitForHealth(`http://${host}:${port}`);
      })(),
      exited,
    ]);

    const pb = new PocketBase(`http://${host}:${port}`);
    await authWithRetries(
      pb,
      process.env.POCKETBASE_SUPERUSER_EMAIL!,
      process.env.POCKETBASE_SUPERUSER_PASSWORD!,
    );
    await fn(pb);
  } finally {
    // Ensure we always clean up the process tree
    stopProcessTree(serverProcess, detached);
  }
}

function stopProcessTree(
  child: ReturnType<typeof spawn>,
  detached: boolean,
): void {
  if (detached && child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Group already gone or unsupported; fall through to the plain kill.
    }
  }
  child.kill();
}
