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
   * The first <outer> element with an <inner> element somewhere inside it:
   * the `Navbar.Item` that holds `AuthMenu.Root`, among several items.
   */
  findElementContaining(outer: string, inner: string): SvelteNode | null {
    return findNode(
      (this.ast as any).fragment,
      (node) =>
        isElement(node, outer) &&
        findNode(node.fragment, (child) => isElement(child, inner)) !== null,
    );
  }

  /** The <child> elements directly inside the first <name> element, in order. */
  childElements(name: string, child: string): SvelteNode[] {
    const node = this.findElement(name);
    const nodes: SvelteNode[] = node?.fragment?.nodes ?? [];
    return nodes.filter((candidate) => isElement(candidate, child));
  }

  /**
   * Put `content` on its own line directly before `node`, at `node`'s
   * indentation. Lines after the first are indented to match too, with their
   * leading tabs turned into the file's indent unit.
   */
  insertBeforeElement(node: SvelteNode, content: string): void {
    const indent = this.indentOf(node.start as number);
    this.s.appendLeft(
      node.start as number,
      `${this.reindent(content, indent)}\n${indent}`,
    );
  }

  /** Like `insertBeforeElement`, on the line after `node`. */
  insertAfterElement(node: SvelteNode, content: string): void {
    const indent = this.indentOf(node.start as number);
    this.s.appendLeft(
      node.end as number,
      `\n${indent}${this.reindent(content, indent)}`,
    );
  }

  /**
   * Remove the first <outer> containing <inner>, and the line it stood on
   * when nothing else shared it. Returns false when there is none.
   */
  removeElementContaining(outer: string, inner: string): boolean {
    const node = this.findElementContaining(outer, inner);
    if (!node) return false;
    let start = node.start as number;
    while (start > 0 && /[ \t]/.test(this.source[start - 1]!)) start--;
    if (start > 0 && this.source[start - 1] === "\n") start--;
    this.s.remove(start, node.end as number);
    return true;
  }

  /** The whitespace between the start of `pos`'s line and `pos`. */
  private indentOf(pos: number): string {
    const lineStart = this.source.lastIndexOf("\n", pos - 1) + 1;
    const lead = this.source.slice(lineStart, pos);
    return /^[ \t]*$/.test(lead) ? lead : "";
  }

  private reindent(content: string, indent: string): string {
    const unit = indent.includes(" ") ? "  " : "\t";
    return content
      .split("\n")
      .map((line, i) => {
        const nested = line.replace(/^\t+/, (tabs) => unit.repeat(tabs.length));
        return i === 0 ? nested : `${indent}${nested}`;
      })
      .join("\n");
  }

  /** Append raw markup to the end of the source file. */
  appendMarkup(content: string): void {
    this.s.append(content);
  }

  /**
   * Insert markup so it renders before the layout's children — i.e. ahead of
   * the top-level `{@render children()}` (or legacy `<slot />`). The markup
   * lands on its own line directly after the preceding sibling, so
   *
   *     <Toaster />
   *
   *     {@render children?.()}
   *
   * becomes `<Toaster />\n<AdminBar />\n\n{@render children?.()}`. When the
   * render tag is the first node the markup goes immediately before it.
   * Returns false (and changes nothing) if no such tag exists.
   */
  insertBeforeChildren(content: string): boolean {
    const nodes: SvelteNode[] = (this.ast as any).fragment?.nodes ?? [];
    const index = nodes.findIndex(
      (node) =>
        node.type === "RenderTag" ||
        node.type === "SlotElement" ||
        (node.type === "RegularElement" && node.name === "slot"),
    );
    if (index === -1) return false;

    const trimmed = content.trim();
    for (let i = index - 1; i >= 0; i--) {
      const prev = nodes[i]!;
      if (prev.type === "Text" && prev.data.trim() === "") continue;
      this.s.appendLeft(prev.end as number, `\n${trimmed}`);
      return true;
    }
    this.s.appendLeft(nodes[index]!.start as number, `${trimmed}\n\n`);
    return true;
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

  /**
   * Remove a named attribute from a component's start tag, including the
   * leading whitespace. No-op if the element or attribute isn't present.
   */
  removeAttribute(name: string, attrName: string): boolean {
    const node = this.findElement(name);
    if (!node) return false;
    const attr = (node.attributes ?? []).find(
      (a: SvelteNode) => a.type === "Attribute" && a.name === attrName,
    );
    if (!attr) return false;
    // Extend the removal backwards over the whitespace between the previous
    // token and this attribute so the tag doesn't collapse `<Foo  />`.
    let start = attr.start as number;
    while (start > 0 && /\s/.test(this.source[start - 1]!)) start--;
    this.s.remove(start, attr.end as number);
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

function isElement(node: any, name: string): boolean {
  return (
    (node?.type === "Component" || node?.type === "RegularElement") &&
    node.name === name
  );
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
