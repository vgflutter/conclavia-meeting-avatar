import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out='public/daily-launch/acting-render';
await mkdir(out,{recursive:true});
await build({entryPoints:['scripts/tg/acting-render-surface.ts'],bundle:true,format:'iife',outfile:out+'/render.js',minify:true});
await writeFile(out+'/index.html','<!doctype html><html lang="it"><meta charset="utf-8"><title>CDaily · renderer locale</title><canvas width="1080" height="1920"></canvas><script src="render.js"></script></html>');
console.log('Offline canonical renderer ready; no Next runtime or provider required.');
