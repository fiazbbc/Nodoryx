import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const devpost = readFileSync(new URL("../DEVPOST.md", import.meta.url), "utf8");
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

test("README documents every required release topic", () => {
  for (const heading of [
    "The problem",
    "The solution",
    "Implemented features",
    "How the simulation works",
    "Anomaly detection",
    "Forecasting",
    "Recommendation engine",
    "Architecture",
    "Tech stack",
    "Local setup",
    "Environment variables",
    "Testing",
    "Deployment",
    "Synthetic-data disclosure",
    "Limitations",
    "Future real-IoT integration",
  ]) {
    assert.match(readme, new RegExp(`## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("documented quality commands exist in package scripts", () => {
  for (const command of [
    "test",
    "test:unit",
    "test:integration",
    "test:e2e",
    "typecheck",
    "lint",
    "build",
  ]) {
    assert.ok(packageJson.scripts[command], `missing npm script: ${command}`);
    assert.match(readme, new RegExp(`npm run ${command.replace(":", "\\:")}|npm ${command}`));
  }
});

test("documentation discloses synthetic data and avoids unsupported AI claims", () => {
  for (const document of [readme, devpost]) {
    assert.match(document, /synthetic/i);
    assert.match(document, /not machine learning|not an LLM|does not currently.*external AI/is);
    assert.doesNotMatch(document, /trained model|machine-learning model|AI confidence/i);
  }
});

test("Devpost draft contains the requested submission sections", () => {
  for (const heading of [
    "Tagline",
    "Short description",
    "Inspiration",
    "What it does",
    "How I built it",
    "Challenges I ran into",
    "Accomplishments that I'm proud of",
    "What I learned",
    "What's next",
    "Technologies and tags",
    "Screenshot recommendations",
    "Suggested 2–3 minute demo video",
  ]) {
    assert.match(devpost, new RegExp(`## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(devpost, /ten-step EV Charging Surge demo/i);
});
