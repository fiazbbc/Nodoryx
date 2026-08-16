import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../app/nodoryx.tsx", import.meta.url),
  "utf8",
);

test("live runtime owns one cleaned-up interval with stable dependencies", () => {
  assert.equal(source.match(/setInterval\(/g)?.length, 1);
  assert.equal(source.match(/clearInterval\(/g)?.length, 1);
  assert.match(
    source,
    /return \(\) => clearInterval\(t\);[\s\S]*?\}, \[playing, speed\]\);/,
  );
});

test("expensive forecast and recommendation derivations are memoized", () => {
  assert.match(source, /useMemo\([\s\S]*?\(\) => demandForecast/);
  assert.match(source, /useMemo\([\s\S]*?\(\) =>[\s\S]*?recommendationsFor/);
  assert.match(source, /view === "Overview" && Overview\(\)/);
});
