import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Return instead of throwing when the command exits non-zero. */
  allowFailure?: boolean;
  /** Append the command and its output to this file. */
  logFile?: string;
  /** Extra stdin content. */
  input?: string;
  /** Kill the command after this long. Defaults to `COMMAND_TIMEOUT_MS`. */
  timeoutMs?: number;
}

export interface RunResult {
  command: string;
  status: number | null;
  stdout: string;
  stderr: string;
  /** The command was killed for running past its timeout. */
  timedOut: boolean;
}

/**
 * `spawnSync` blocks the event loop, so vitest's `testTimeout` cannot fire
 * while a command runs: without this, a child that never exits (a server left
 * polling) hangs the whole suite until CI kills the job.
 */
export const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

const MAX_BUFFER = 256 * 1024 * 1024;
const ERROR_TAIL = 6000;

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function npmBin(): string {
  return isWindows() ? "npm.cmd" : "npm";
}

export function npxBin(): string {
  return isWindows() ? "npx.cmd" : "npx";
}

export function formatCommand(command: string, args: string[]): string {
  return [
    command,
    ...args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)),
  ].join(" ");
}

function tail(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > ERROR_TAIL
    ? `…${trimmed.slice(-ERROR_TAIL)}`
    : trimmed;
}

export function exitLabel(result: RunResult): string {
  if (result.timedOut) return "timed out";
  return String(result.status ?? "spawn-error");
}

export function appendLog(logFile: string, text: string): void {
  mkdirSync(path.dirname(logFile), { recursive: true });
  appendFileSync(logFile, text);
}

/**
 * Runs a command to completion. Every invocation is appended to `logFile`
 * (command line, cwd, stdout, stderr, exit code) so a failed case can be
 * reconstructed from its log alone.
 */
export function run(
  command: string,
  args: string[],
  opts: RunOptions,
): RunResult {
  const printable = formatCommand(command, args);
  const startedAt = Date.now();
  const proc = spawnSync(command, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    input: opts.input,
    timeout: opts.timeoutMs ?? COMMAND_TIMEOUT_MS,
    // SIGKILL: `npm run` traps SIGTERM to forward it and would keep waiting on
    // the stuck grandchild. The grandchild is orphaned, but the pipes close.
    killSignal: "SIGKILL",
  });

  const stdout = proc.stdout ?? "";
  const stderr = proc.stderr ?? "";
  const status = proc.error ? null : proc.status;
  const timedOut =
    (proc.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
  const result: RunResult = {
    command: printable,
    status,
    stdout,
    stderr,
    timedOut,
  };

  if (opts.logFile) {
    appendLog(
      opts.logFile,
      [
        "",
        `$ ${printable}`,
        `  (cwd: ${opts.cwd}, ${Date.now() - startedAt}ms, exit ${exitLabel(result)})`,
        proc.error ? `  spawn error: ${proc.error.message}` : "",
        stdout ? `--- stdout\n${stdout.trimEnd()}` : "",
        stderr ? `--- stderr\n${stderr.trimEnd()}` : "",
        "",
      ]
        .filter((line) => line !== "")
        .join("\n") + "\n",
    );
  }

  if (status !== 0 && !opts.allowFailure) {
    const details = [
      `Command failed (exit ${exitLabel(result)}): ${printable}`,
      `cwd: ${opts.cwd}`,
      proc.error ? `spawn error: ${proc.error.message}` : "",
      stdout.trim() ? `stdout:\n${tail(stdout)}` : "",
      stderr.trim() ? `stderr:\n${tail(stderr)}` : "",
      opts.logFile ? `full log: ${opts.logFile}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    throw new Error(details);
  }

  return result;
}
