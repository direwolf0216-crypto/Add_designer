import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The app ships trimmed icon fonts (scripts/icons/build-icons.mjs). If code uses an icon the trimmed
// set lacks, it would show as a blank square: rebuild the icons when this fails.
const SRC = join(process.cwd(), "src");
const ICONS = join(SRC, "styles/icons");
const NOT_ICONS = new Set(["ph-bold", "ph-fill", "ph-caret"]); // weight classes, and the `ph-caret-${…}` prefix

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (p.startsWith(ICONS)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

describe("trimmed icon fonts", () => {
  const used = new Set<string>(["ph-caret-up", "ph-caret-down"]);
  for (const f of walk(SRC)) for (const m of readFileSync(f, "utf8").matchAll(/\bph-[a-z0-9]+(?:-[a-z0-9]+)*/g)) if (!NOT_ICONS.has(m[0])) used.add(m[0]);

  for (const weight of ["regular", "bold", "fill"]) {
    it(`${weight} holds every icon the code uses`, () => {
      const css = readFileSync(join(ICONS, `phosphor-${weight}.css`), "utf8");
      const have = new Set([...css.matchAll(/\.(ph-[a-z0-9-]+):before/g)].map((m) => m[1]));
      const missing = [...used].filter((n) => !have.has(n));
      expect(missing, "run scripts/icons/build-icons.mjs").toEqual([]);
    });
  }
});
