import prettier from "prettier";
import type { File, Result } from "./types";
import sveltePlugin from "prettier-plugin-svelte";

function canFormatFile(file: File): boolean {
  return (
    file.language === "ts" ||
    file.language === "svelte" ||
    file.path.endsWith(".json")
  );
}

async function formatFile(file: File): Promise<File> {
  if (file.status !== "success" || !canFormatFile(file)) {
    return file;
  }

  try {
    const content = await prettier.format(file.content, {
      filepath: file.path,
      plugins: [sveltePlugin],
    });
    return {
      ...file,
      content,
    };
  } catch {
    return file;
  }
}

async function formatFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => formatFile(file)));
}

export async function formatResult(result: Result): Promise<Result> {
  const [creates, modifies] = await Promise.all([
    formatFiles(result.creates),
    formatFiles(result.modifies),
  ]);

  return {
    ...result,
    creates,
    modifies,
  };
}
