import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve,join,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
/** Private loopback-only renderer; independent of Next dev/build and app ports. */
export async function macRenderServer(){
 const directory=join(root,'.daily-agent/mac-render');await mkdir(directory,{recursive:true,mode:0o700});
 await build({absWorkingDir:root,entryPoints:['scripts/tg/daily-render-surface.ts'],bundle:true,format:'iife',minify:true,logLevel:'silent',outfile:join(directory,'render.js')});
 await writeFile(join(directory,'index.html'),'<!doctype html><html lang="it"><meta charset="utf-8"><title>CDaily private renderer</title><canvas></canvas><script src="render.js"></script></html>',{mode:0o600});
 const server=createServer(async(req,res)=>{
  try{
   if(req.method!=='GET')throw Error();
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file,base;
   if(path==='/__cdaily-render__/'||path==='/__cdaily-render__/index.html'){base=directory;file=join(directory,'index.html');}
   else if(path==='/__cdaily-render__/render.js'){base=directory;file=join(directory,'render.js');}
   else if(/^\/(brand|daily-studio)\/[a-zA-Z0-9._-]+\.(png|jpg|svg|woff2)$/u.test(path)){base=join(root,'public');file=resolve(base,'.'+path);}
   else throw Error();
   const actual=await realpath(file);if(!actual.startsWith(await realpath(base)+sep))throw Error();
   const bytes=await readFile(actual),extension=actual.split('.').at(-1);
   res.writeHead(200,{'Content-Type':({html:'text/html',js:'text/javascript',png:'image/png',jpg:'image/jpeg',svg:'image/svg+xml',woff2:'font/woff2'})[extension]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 return {origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(ok=>server.close(ok))};
}
