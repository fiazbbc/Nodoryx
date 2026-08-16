import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/nodoryx.tsx", import.meta.url), "utf8");

test("every rendered button has a real click handler", () => {
  const buttons = [...source.matchAll(/<button\b([\s\S]*?)>/g)];
  assert.ok(buttons.length > 20, "expected the application control surface");
  for (const button of buttons) {
    assert.match(button[1], /onClick=/, `decorative button found: ${button[0]}`);
  }
});

test("landing preview does not present a fake Apply control", () => {
  const landing = source.slice(source.indexOf("function Landing"));
  assert.doesNotMatch(landing, /<button>\s*APPLY/i);
  assert.match(landing, /ILLUSTRATIVE RESPONSE/);
});

test("transient panels stay synchronized and clean up keyboard listeners", () => {
  assert.match(source, /selectedId[\s\S]*devices\.find/);
  assert.match(source, /window\.addEventListener\("keydown", closeTransientUi\)/);
  assert.match(source, /window\.removeEventListener\("keydown", closeTransientUi\)/);
  assert.match(source, /aria-label="Close device details"/);
  assert.match(source, /aria-label="Close about dialog"/);
});

test("reset restores a live deterministic baseline", () => {
  const resetBody = source.slice(source.indexOf("const reset ="), source.indexOf("const changeEnv ="));
  assert.match(resetBody, /setMinute\(548\)/);
  assert.match(resetBody, /setTotals\(emptyTotals\(\)\)/);
  assert.match(resetBody, /setDevices\(createDevices\(next, 548\)\)/);
  assert.match(resetBody, /setPlaying\(true\)/);
  assert.match(resetBody, /setSelectedId\(null\)/);
});
