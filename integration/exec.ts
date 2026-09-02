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
}

export interface RunResult {
  command: string;
  status: number | null;
  stdout: string;
  stderr: string;
}

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
  });

  const stdout = proc.stdout ?? "";
  const stderr = proc.stderr ?? "";
  const status = proc.error ? null : proc.status;
  const result: RunResult = { command: printable, status, stdout, stderr };

  if (opts.logFile) {
    appendLog(
      opts.logFile,
      [
        "",
        `$ ${printable}`,
        `  (cwd: ${opts.cwd}, ${Date.now() - startedAt}ms, exit ${status ?? "spawn-error"})`,
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
      `Command failed (exit ${status ?? "spawn-error"}): ${printable}`,
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
