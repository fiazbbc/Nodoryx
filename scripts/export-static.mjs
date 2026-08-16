import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "dist/client");
const output = resolve(root, "vercel-dist");
const serverEntry = resolve(root, "dist/server/index.js");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

const moduleUrl = pathToFileURL(serverEntry);
moduleUrl.searchParams.set("static-export", Date.now().toString());
const { default: worker } = await import(moduleUrl.href);
const response = await worker.fetch(
  new Request("https://nodoryx.local/", {
    headers: { accept: "text/html" },
  }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  {
    waitUntil() {},
    passThroughOnException() {},
  },
);

if (!response.ok) {
  throw new Error(`Static render failed with status ${response.status}`);
}

await writeFile(resolve(output, "index.html"), await response.text(), "utf8");
