import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {ALEX2_PROBE_TEXT,alex2ProofDirectory,alex2SynthesisVerified} from '../../src/lib/tg/alex2-proof';
import {alex2Config,alex2ConfigDigest} from '../../src/lib/tg/alex2-config';
import {wave} from '../../src/lib/tg/media';

test('voice readiness requires matching recent receipt, complete word times and audible unchanged audio',async()=>{
 const temporary=await mkdtemp(path.join(os.tmpdir(),'daily-voice-proof-')),previous=process.cwd();
 const env={ELEVENLABS_API_KEY:'synthetic-test-key',TG_IT_ELEVENLABS_VOICE_ID:'synthetic-voice-id',TG_ELEVENLABS_MODEL_ID:'eleven_v4'};
 const now=Date.now(),seconds=12,pcm=Buffer.alloc(seconds*48000);
 for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.2)*3000),i*2);
 try{
  process.chdir(temporary);const directory=alex2ProofDirectory();await mkdir(directory,{recursive:true});
  assert.equal(alex2SynthesisVerified(env,now),false,'presence of a key alone never passes');
  const audio=wave(pcm),proof={version:1,checkedAt:new Date(now).toISOString(),configSha256:alex2ConfigDigest(alex2Config(env)),text:ALEX2_PROBE_TEXT,seconds,
   audioSha256:createHash('sha256').update(audio).digest('hex'),words:ALEX2_PROBE_TEXT.split(/\s+/u).map((text,i)=>({text,start:i*.25,end:i*.25+.2}))};
  await writeFile(path.join(directory,'take.wav'),audio);await writeFile(path.join(directory,'proof.json'),JSON.stringify(proof));
  assert.equal(alex2SynthesisVerified(env,now),true);
  assert.equal(alex2SynthesisVerified({...env,TG_IT_ELEVENLABS_VOICE_ID:'different-voice'},now),false);
  assert.equal(alex2SynthesisVerified(env,now+8*86400000),false);
  const silent=wave(Buffer.alloc(pcm.length));
  await writeFile(path.join(directory,'take.wav'),silent);
  assert.equal(alex2SynthesisVerified(env,now),false,'altered/silent PCM cannot remain verified');
  await writeFile(path.join(directory,'proof.json'),JSON.stringify({...proof,audioSha256:createHash('sha256').update(silent).digest('hex')}));
  assert.equal(alex2SynthesisVerified(env,now),false,'a matching receipt cannot certify inaudible provider output');
 }finally{process.chdir(previous);await rm(temporary,{recursive:true,force:true});}
});
