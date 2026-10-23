import assert from 'node:assert/strict';
import {test} from 'node:test';
import {insertDailyOpeningPause} from '../../src/lib/tg/opening-pause';

test('the opening edit creates a measured two-second word gap without changing speech or earlier anchors',()=>{
 const rate=24000,pcm=Buffer.alloc(rate*3*2);
 for(let i=0;i<rate;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.08)*4000),i*2);
 for(let i=Math.round(rate*1.2);i<rate*3;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.07)*3500),i*2);
 const words=[{text:'Introduzione.',start:0,end:1},{text:'Prima',start:1.2,end:1.7},{text:'notizia.',start:1.8,end:2.7}];
 const original=Buffer.from(pcm),result=insertDailyOpeningPause(pcm,words,rate,1,1.2,2),cut=Math.round(result.edit.atSeconds*rate),added=Math.round(result.edit.addedSeconds*rate),fade=Math.round(result.edit.fadeSeconds*rate);
 assert.equal(result.edit.wordGapSeconds,2);
 assert.deepEqual(pcm,original,'source recording is preserved');
 assert.deepEqual(result.words[0],words[0]);assert.equal(result.words[1].start-result.words[0].end,2);
 assert.deepEqual(result.pcm.subarray(0,(cut-fade)*2),pcm.subarray(0,(cut-fade)*2));
 assert.deepEqual(result.pcm.subarray((cut+added+fade)*2),pcm.subarray((cut+fade)*2));
 assert.ok(result.pcm.subarray(cut*2,(cut+added)*2).every(x=>x===0));
 assert.equal(result.pcm.readInt16LE((cut-1)*2),0);assert.equal(result.pcm.readInt16LE((cut+added)*2),0);
 assert.equal(result.pcm.length-pcm.length,added*2);
});

test('an unsafe or unmeasured opening cut fails instead of cutting a word or assuming silence',()=>{
 const rate=24000,pcm=Buffer.alloc(rate*2*2);for(let i=0;i<pcm.length;i+=2)pcm.writeInt16LE(5000,i);
 assert.throws(()=>insertDailyOpeningPause(pcm,[],rate,.8,1,2),/not safely quiet/);
 assert.throws(()=>insertDailyOpeningPause(Buffer.alloc(rate*2*2),[{text:'Parola',start:.7,end:1.2}],rate,.8,1,2),/not safely quiet/);
 assert.throws(()=>insertDailyOpeningPause(pcm,[],rate,1,1.005,2),/No measured word-free/);
});
