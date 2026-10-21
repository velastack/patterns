import { describe, expect, it } from "vitest";
import { SvelteFile } from "./svelte-file";

const LAYOUT = [
  "<Navbar.List>",
  "\t<Navbar.Item>",
  '\t\t<Button href="/">Home</Button>',
  "\t</Navbar.Item>",
  '\t<Navbar.Item class="x">',
  "\t\t<AuthMenu.Root />",
  "\t</Navbar.Item>",
  "</Navbar.List>",
  "",
].join("\n");

const ITEM = "<Navbar.Item>\n\t<CartButton />\n</Navbar.Item>";

describe("SvelteFile navbar helpers", () => {
  it("finds the element that contains another, not just the first by name", () => {
    const file = new SvelteFile(LAYOUT);
    const node = file.findElementContaining("Navbar.Item", "AuthMenu.Root");
    expect(LAYOUT.slice(node!.start, node!.end)).toContain("AuthMenu.Root");
    expect(file.findElementContaining("Navbar.Item", "Missing")).toBeNull();
  });

  it("lists the direct children of an element by name", () => {
    expect(
      new SvelteFile(LAYOUT).childElements("Navbar.List", "Navbar.Item"),
    ).toHaveLength(2);
  });

  it("inserts before an element on its own line, at its indentation", () => {
    const file = new SvelteFile(LAYOUT);
    file.insertBeforeElement(
      file.findElementContaining("Navbar.Item", "AuthMenu.Root")!,
      ITEM,
    );
    expect(file.toString()).toContain(
      [
        "\t</Navbar.Item>",
        "\t<Navbar.Item>",
        "\t\t<CartButton />",
        "\t</Navbar.Item>",
        '\t<Navbar.Item class="x">',
      ].join("\n"),
    );
  });

  it("inserts after an element, using the file's indent unit", () => {
    const spaced = LAYOUT.replace(/\t/g, "  ");
    const file = new SvelteFile(spaced);
    file.insertAfterElement(
      file.childElements("Navbar.List", "Navbar.Item")[0]!,
      ITEM,
    );
    expect(file.toString()).toContain(
      [
        "  </Navbar.Item>",
        "  <Navbar.Item>",
        "    <CartButton />",
        "  </Navbar.Item>",
        '  <Navbar.Item class="x">',
      ].join("\n"),
    );
  });

  it("removes the containing element and the line it stood on", () => {
    const file = new SvelteFile(LAYOUT);
    expect(file.removeElementContaining("Navbar.Item", "AuthMenu.Root")).toBe(
      true,
    );
    expect(file.toString()).toBe(
      [
        "<Navbar.List>",
        "\t<Navbar.Item>",
        '\t\t<Button href="/">Home</Button>',
        "\t</Navbar.Item>",
        "</Navbar.List>",
        "",
      ].join("\n"),
    );
    expect(
      new SvelteFile(LAYOUT).removeElementContaining("Navbar.Item", "Missing"),
    ).toBe(false);
  });
});
