import fs from "node:fs";
import { parse, type AST } from "svelte/compiler";
import MagicString from "magic-string";

type SvelteAst = AST.Root;
type SvelteNode = any;

interface ScriptBlock {
  content: string;
  start: number;
  end: number;
}

/**
 * Surgical, AST-aware editing of .svelte files.
 *
 * Parses the source with svelte/compiler to discover precise character offsets,
 * then applies edits via magic-string so untouched regions remain byte-for-byte
 * identical to the original. Script-block contents are exposed as plain strings
 * so callers can hand them to ts-morph.
 */
export class SvelteFile {
  private readonly source: string;
  private readonly ast: SvelteAst;
  private readonly s: MagicString;

  constructor(source: string) {
    this.source = source;
    this.ast = parse(source, { modern: true });
    this.s = new MagicString(source);
  }

  static fromPath(filePath: string): SvelteFile {
    return new SvelteFile(fs.readFileSync(filePath, "utf8"));
  }

  getScript(): ScriptBlock | null {
    return this.scriptInner((this.ast as any).instance);
  }

  getModuleScript(): ScriptBlock | null {
    return this.scriptInner((this.ast as any).module);
  }

  private scriptInner(script: SvelteNode | null): ScriptBlock | null {
    if (!script) return null;
    const start = script.content.start as number;
    const end = script.content.end as number;
    return { content: this.source.slice(start, end), start, end };
  }

  /**
   * Replace the inner contents of <script>. Use for ts-morph round-trips.
   * Returns true when an edit was made.
   */
  modifyScript(fn: (content: string) => string): boolean {
    return this.modifyScriptBlock(this.getScript(), fn);
  }

  modifyModuleScript(fn: (content: string) => string): boolean {
    return this.modifyScriptBlock(this.getModuleScript(), fn);
  }

  private modifyScriptBlock(
    block: ScriptBlock | null,
    fn: (content: string) => string,
  ): boolean {
    if (!block) return false;
    const next = fn(block.content);
    if (next === block.content) return false;
    this.s.overwrite(block.start, block.end, next);
    return true;
  }

  /** First Component or RegularElement node with the given name. */
  findElement(name: string): SvelteNode | null {
    return findNode(
      (this.ast as any).fragment,
      (node) =>
        (node.type === "Component" || node.type === "RegularElement") &&
        node.name === name,
    );
  }

  hasElement(name: string): boolean {
    return this.findElement(name) !== null;
  }

  hasAttribute(componentName: string, attrName: string): boolean {
    const node = this.findElement(componentName);
    if (!node) return false;
    return (node.attributes ?? []).some(
      (attr: SvelteNode) => attr.type === "Attribute" && attr.name === attrName,
    );
  }

  /**
   * Insert content at the end of <ComponentName>'s children, just before the
   * closing tag. No-op if the element is not found.
   */
  insertBeforeClosingTag(name: string, content: string): boolean {
    const node = this.findElement(name);
    if (!node) return false;
    const closingTag = `</${name}>`;
    const closingPos = this.source.lastIndexOf(closingTag, node.end);
    if (closingPos === -1) return false;
    this.s.appendLeft(closingPos, content);
    return true;
  }

  /** Replace the element entirely (start tag through close tag). */
  replaceElement(name: string, newContent: string): boolean {
    const node = this.findElement(name);
    if (!node) return false;
    this.s.overwrite(node.start, node.end, newContent);
    return true;
  }

  /** Remove the element (start tag through close tag). */
  removeElement(name: string): boolean {
    return this.replaceElement(name, "");
  }

  /**
   * Append attribute text (e.g. " team={data.team}") just after the last
   * existing attribute on the element's start tag.
   */
  appendToAttributes(name: string, attrs: string): boolean {
    const node = this.findElement(name);
    if (!node) return false;
    const last = (node.attributes ?? []).at(-1) as SvelteNode | undefined;
    const insertAt = last
      ? (last.end as number)
      : (node.start as number) + `<${name}`.length;
    this.s.appendLeft(insertAt, attrs);
    return true;
  }

  hasChanged(): boolean {
    return this.s.hasChanged();
  }

  toString(): string {
    return this.s.toString();
  }

  writeTo(filePath: string): void {
    if (this.hasChanged()) {
      fs.writeFileSync(filePath, this.toString(), "utf8");
    }
  }
}

function findNode(
  root: unknown,
  predicate: (node: any) => boolean,
): any | null {
  const seen = new WeakSet<object>();
  function visit(node: unknown): any | null {
    if (!node || typeof node !== "object" || seen.has(node as object)) {
      return null;
    }
    seen.add(node as object);
    if (predicate(node as any)) return node;
    for (const key of Object.keys(node as Record<string, unknown>)) {
      if (key === "parent") continue;
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = visit(item);
          if (found) return found;
        }
      } else if (
        child &&
        typeof child === "object" &&
        "type" in (child as object)
      ) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  }
  return visit(root);
}
