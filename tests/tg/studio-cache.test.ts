import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {preserveSpeechIntermediates} from '../../scripts/tg/studio-cache';

test('a graphic refresh retains raw voice PCM/cache/checkpoint without copying stale videos',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'conclavia-studio-cache-')),source=path.join(root,'source'),dest=path.join(root,'stage');
 try{
  await mkdir(path.join(source,'.speech'),{recursive:true});await mkdir(dest);
  const pcm=Buffer.from([0,31,128,255,3]);
  await writeFile(path.join(source,'raw.wav'),pcm);await writeFile(path.join(source,'.speech','voice-key.pcm'),pcm);
  await writeFile(path.join(source,'.trial-checkpoint.json'),'original checkpoint');
  await writeFile(path.join(source,'portrait.mp4'),'stale render');
  assert.deepEqual(await preserveSpeechIntermediates(source,dest),['raw.wav','.speech','.trial-checkpoint.json']);
  assert.deepEqual(await readFile(path.join(dest,'raw.wav')),pcm);assert.deepEqual(await readFile(path.join(dest,'.speech','voice-key.pcm')),pcm);
  assert.equal(await readFile(path.join(dest,'.trial-checkpoint.json'),'utf8'),'original checkpoint');
  assert.ok(!(await readdir(dest)).includes('portrait.mp4'));
 }finally{await rm(root,{recursive:true,force:true});}
});
