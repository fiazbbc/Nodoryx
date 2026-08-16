import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../app/polish.css", import.meta.url), "utf8");
const ui = await readFile(new URL("../app/nodoryx.tsx", import.meta.url), "utf8");

test("representative desktop, tablet, and mobile ranges have explicit layout contracts", () => {
  for (const breakpoint of [1200, 1100, 1050, 820, 620, 420]) {
    assert.match(css, new RegExp(`max-width:\\s*${breakpoint}px`));
  }
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /\.linechart,[\s\S]*?width:\s*100%/);
  assert.match(css, /\.drawer,[\s\S]*?max-height:\s*calc\(100dvh - 24px\)/);
});

test("tablet and mobile preserve navigation, controls, and every device field", () => {
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?aside nav[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.headcontrols \.ghost,[\s\S]*?display:\s*block/);
  assert.match(css, /\.tr:not\(\.th\) > span:before[\s\S]*?content:\s*attr\(data-label\)/);
  for (const label of ["Device", "Zone", "Power", "Health", "Priority", "Anomaly"]) {
    assert.match(ui, new RegExp(`data-label="${label}"`));
  }
});
