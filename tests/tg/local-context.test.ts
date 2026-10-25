import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {editorialFixture} from './editorial-fixture';
test('the local handoff and size report run with network denied and retain the dated fixed copy',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'cdaily-context-')),now=new Date('2026-10-25T08:01:00Z');
 try{
  await mkdir(path.join(root,'config/tg'),{recursive:true});await mkdir(path.join(root,'docs/tg'),{recursive:true});
  await writeFile(path.join(root,'config/tg/daily-agent.json'),await readFile('config/tg/daily-agent.json'));
  await writeFile(path.join(root,'docs/tg/cdaily-editorial-standard-20261025.md'),'Synthetic local policy fixture.');
  const j=editorialFixture(now),directory=path.join(root,'.tg-artifacts/editorial/2026-10-25');await mkdir(directory,{recursive:true});
  const data=j.research!.stories.map(s=>({storyId:s.id,brief:('A complete evidence paragraph '+s.id+' ').repeat(100),sources:[{url:'https://www.rainews.it/'+s.id,title:s.headline}]}));
  await writeFile(path.join(directory,'session.json'),JSON.stringify(j));
  await writeFile(path.join(directory,'evidence.json'),JSON.stringify({data,sources:data.flatMap(d=>d.sources),webByStory:Object.fromEntries(data.map(d=>[d.storyId,d.sources.map(s=>s.url)]))}));
  const preload=path.join(root,'offline.cjs');
  await writeFile(preload,`const OriginalDate=Date;global.Date=class extends OriginalDate{constructor(...a){super(...(a.length?a:['2026-10-25T08:01:00Z']));}static now(){return ${now.getTime()};}};globalThis.fetch=()=>{throw Error('Network forbidden');};require('node:net').Socket.prototype.connect=()=>{throw Error('Socket forbidden');};`);
  const result=await new Promise<{code:number;output:string}>((resolve,reject)=>{
   const loader=createRequire(path.resolve('package.json')).resolve('tsx');
   const child=spawn(process.execPath,['--require',preload,'--conditions=react-server','--import',loader,path.resolve('scripts/tg/local-context.ts'),'--measure','.tg-artifacts/editorial/2026-10-25/session.json'],{cwd:root,env:{...process.env,TSX_TSCONFIG_PATH:path.resolve('tsconfig.json')},stdio:['ignore','pipe','pipe']});
   let output='';child.stdout.on('data',v=>output+=String(v));child.stderr.on('data',v=>output+=String(v));child.once('error',reject);child.once('close',code=>resolve({code:code??1,output}));
  });
  assert.equal(result.code,0,result.output);const report=JSON.parse(result.output);
  assert.equal(report.networkCalls,0);assert.equal(report.providerCalls,0);assert.equal(report.mediaGenerated,false);
  const contextFile=path.join(root,report.contextFile),context=await readFile(contextFile,'utf8');
  assert.match(context,/venticinque ottobre/u);assert.match(context,/commenti/u);assert.match(context,/manual/u);
  assert.equal((await stat(contextFile)).mode&0o777,0o600);
  assert.ok(report.measurement.afterCharacters<report.measurement.beforeCharacters);
  assert.equal(report.measurement.targets,j.script!.sentences.length+2);
 }finally{await rm(root,{recursive:true,force:true});}
});
