import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {runMacCommand} from '../../scripts/tg/mac-process.mjs';

test('Mac commands return bounded stdout and reject a cancelled launch',async()=>{
 assert.equal(await runMacCommand(process.execPath,['-e','process.stdout.write("ready")']),'ready');
 await assert.rejects(runMacCommand(process.execPath,['-e','process.exit(0)'],{signal:AbortSignal.abort()}),/interrotto/u);
});

test('a production deadline terminates the child and its resistant descendant',{skip:process.platform==='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'cdaily-process-')),file=join(directory,'pids.json');
 let pids=[];
 try{
  const descendant='process.on("SIGTERM",()=>{});setInterval(()=>{},1000);';
  const source=`const {spawn}=require("node:child_process");const child=spawn(process.execPath,["-e",${JSON.stringify(descendant)}],{stdio:"ignore"});require("node:fs").writeFileSync(process.argv[1],JSON.stringify([process.pid,child.pid]));setInterval(()=>{},1000);`;
  await assert.rejects(runMacCommand(process.execPath,['-e',source,file],{timeout:1000}),/non completato/u);
  pids=JSON.parse(await readFile(file,'utf8'));
  for(let retry=0;retry<30;retry++){
   const alive=pids.filter(pid=>{try{process.kill(pid,0);return true;}catch{return false;}});
   if(!alive.length)break;
   await delay(50);
  }
  for(const pid of pids)assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
 }finally{
  for(const pid of pids)try{process.kill(pid,'SIGKILL');}catch{}
  await rm(directory,{recursive:true,force:true});
 }
});
