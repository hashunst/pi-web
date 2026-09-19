import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./ChatInput.tsx", import.meta.url), "utf8");

test("anchors the reasoning dropdown to the mobile menu edge (inline) and inline end on desktop", () => {
  assert.match(
    source,
    /thinkingDropdownOpen[\s\S]*?bottom: "calc\(100% \+ 6px\)"[\s\S]*?isMobile \? \{ insetInlineStart: 0 \} : \{ insetInlineEnd: 0 \}/,
  );
});
