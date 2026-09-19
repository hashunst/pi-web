import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { THEME_INIT_SCRIPT, THEME_OPTIONS, isDarkTheme, isThemePreference } from "./theme.ts";

test("first paint restores every palette and falls back to the system for invalid or blocked storage", () => {
  for (const systemDark of [false, true]) {
    for (const stored of [...THEME_OPTIONS.map(({ id }) => id), null, "", "unknown", new Error("Blocked")]) {
      const root = { dataset: {}, classList: { toggle: (name, value) => { root[name] = value; } } };
      runInNewContext(THEME_INIT_SCRIPT, {
        localStorage: { getItem: () => { if (stored instanceof Error) throw stored; return stored; } },
        window: { matchMedia: () => ({ matches: systemDark }) },
        document: { documentElement: root },
      });
      const expected = isThemePreference(stored) && stored !== "auto" ? stored : systemDark ? "dark" : "light";
      assert.equal(root.dataset.theme, expected);
      assert.equal(root.dark, isDarkTheme(expected));
      // No browser locale available in this sandbox: the locale script falls back to English/LTR.
      assert.equal(root.lang, "en");
      assert.equal(root.dir, "ltr");
    }
  }
});

test("first paint restores the stored language and direction", () => {
  for (const stored of ["en", "zh-CN", "zh-TW", "fa"]) {
    const root = { dataset: {}, classList: { toggle: (name, value) => { root[name] = value; } } };
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: { getItem: () => stored },
      window: { matchMedia: () => ({ matches: false }) },
      document: { documentElement: root },
    });
    assert.equal(root.lang, stored);
    assert.equal(root.dir, stored === "fa" ? "rtl" : "ltr");
  }
});
