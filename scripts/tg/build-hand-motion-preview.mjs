/** Rebuild this static local proof in seconds; no Next build or provider call. */
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
await build({absWorkingDir:root,entryPoints:['scripts/tg/hand-motion-preview.ts'],bundle:true,format:'iife',outfile:'public/daily-launch/hand-lab/preview.js',minify:true});
const folder=new URL('../../public/daily-launch/hand-lab/',import.meta.url),version=createHash('sha256').update(await readFile(new URL('preview.js',folder))).digest('hex').slice(0,12),html=new URL('index.html',folder);
await writeFile(html,(await readFile(html,'utf8')).replace(/src="preview\.js(?:\?v=[^"]*)?"/u,`src="preview.js?v=${version}"`));
console.log('Silent hand and editorial proofs rebuilt. Open /daily-launch/hand-lab/index.html on the local app.');
