import assert from "node:assert/strict";
import test from "node:test";

async function render(){
 const workerUrl=new URL("../dist/server/index.js",import.meta.url);workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);const{default:worker}=await import(workerUrl.href);
 return worker.fetch(new Request("http://localhost/",{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
}

test("server renders the Nodoryx product landing page",async()=>{
 const response=await render();assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/^text\/html\b/i);const html=await response.text();
 assert.match(html,/<title>Nodoryx/);assert.match(html,/Predict energy problems/);assert.match(html,/Launch Live Simulation/);assert.match(html,/SYNTHETIC TELEMETRY/);assert.match(html,/NO LOGIN/);assert.doesNotMatch(html,/Your site is taking shape/);
});

test("landing page communicates the EV demo without a fake action control",async()=>{
 const html=await (await render()).text();assert.match(html,/Capacity risk detected/);assert.match(html,/EV charging/);assert.match(html,/NODORYX RECOMMENDS/);assert.match(html,/ILLUSTRATIVE RESPONSE/);assert.doesNotMatch(html,/<button>APPLY/);
});
