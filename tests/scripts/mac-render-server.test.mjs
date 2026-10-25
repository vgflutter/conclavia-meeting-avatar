import assert from 'node:assert/strict';
import {test} from 'node:test';
import {macRenderServer} from '../../scripts/tg/mac-render-server.mjs';
test('the Mac renderer serves approved assets on loopback and never exposes private or trial files',async()=>{
 const server=await macRenderServer();
 try{
  assert.match(server.origin,/^http:\/\/127\.0\.0\.1:\d+$/u);
  for(const path of ['/__cdaily-render__/','/__cdaily-render__/render.js','/brand/cdaily.svg'])assert.equal((await fetch(server.origin+path)).status,200);
  for(const path of ['/.env.local','/.daily-agent/mac-installation.json','/daily-launch/editions/2026-10-24-it-pilot-r1/manifest.json','/brand/../.env.local'])assert.equal((await fetch(server.origin+path)).status,404);
  assert.equal((await fetch(server.origin+'/__cdaily-render__/',{method:'POST',body:'synthetic'})).status,404);
 }finally{await server.close();}
});
