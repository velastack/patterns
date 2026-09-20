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
   * Remove the element along with the nearest enclosing <wrapper> — the nav
   * item, list entry or column an enable pattern added purely to host it.
   * The wrapper only goes when it holds nothing else, so a hand-edited
   * wrapper that picked up a sibling keeps its place and just the element is
   * taken out. Whitespace ahead of the wrapper goes with it, leaving no blank
   * line where it stood.
   */
  removeElementWithWrapper(name: string, wrapperName: string): boolean {
    const path = this.findElementPath(name);
    if (!path) return false;

    const node = path[path.length - 1]!;
    let wrapper: SvelteNode | null = null;
    // Nearest first: an inner wrapper of the same name wins over an outer one.
    for (let i = path.length - 2; i >= 0; i--) {
      const candidate = path[i]!;
      if (
        (candidate.type === "Component" ||
          candidate.type === "RegularElement") &&
        candidate.name === wrapperName
      ) {
        wrapper = candidate;
        break;
      }
    }

    if (!wrapper || this.holdsMoreThan(wrapper, path)) {
      this.s.remove(node.start as number, node.end as number);
      return true;
    }

    let start = wrapper.start as number;
    while (start > 0 && /\s/.test(this.source[start - 1]!)) start--;
    this.s.remove(start, wrapper.end as number);
    return true;
  }

  /**
   * Whether the wrapper has children beyond whitespace and the one subtree on
   * `path` that leads down to the element being removed.
   */
  private holdsMoreThan(wrapper: SvelteNode, path: SvelteNode[]): boolean {
    const onPath = new Set(path);
    const children: SvelteNode[] = wrapper.fragment?.nodes ?? [];
    return children.some(
      (child) =>
        !onPath.has(child) &&
        !(child.type === "Text" && String(child.data).trim() === ""),
    );
  }

  /**
   * The chain of AST nodes from the fragment root down to the first Component
   * or RegularElement with the given name, that node last. Null when absent.
   */
  private findElementPath(name: string): SvelteNode[] | null {
    return findPath(
      (this.ast as any).fragment,
      (node) =>
        (node.type === "Component" || node.type === "RegularElement") &&
        node.name === name,
    );
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

function findNode(
  root: unknown,
  predicate: (node: any) => boolean,
): any | null {
  const path = findPath(root, predicate);
  return path ? path[path.length - 1] : null;
}

/**
 * Depth-first search returning every node on the way down to the match, the
 * match itself last — so callers can reach an ancestor without the AST
 * carrying parent links.
 */
function findPath(
  root: unknown,
  predicate: (node: any) => boolean,
): any[] | null {
  const seen = new WeakSet<object>();
  function visit(node: unknown, ancestors: any[]): any[] | null {
    if (!node || typeof node !== "object" || seen.has(node as object)) {
      return null;
    }
    seen.add(node as object);
    const path = "type" in (node as object) ? [...ancestors, node] : ancestors;
    if (predicate(node as any)) return path;
    for (const key of Object.keys(node as Record<string, unknown>)) {
      if (key === "parent") continue;
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = visit(item, path);
          if (found) return found;
        }
      } else if (
        child &&
        typeof child === "object" &&
        "type" in (child as object)
      ) {
        const found = visit(child, path);
        if (found) return found;
      }
    }
    return null;
  }
  return visit(root, []);
}
