/** Reuse checked word anchors and audio. No ASR, synthesis, database or social. */
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {punctuateSpeechWordAnchors} from '@conclavia/avatar-kit/speech';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {creativePilots} from '../../src/components/tg/daily-creative-pilots';
async function main(){
 if(!process.argv.includes('--confirm'))throw Error('Explicit local caption refinement required');
 const review=path.resolve('.tg-artifacts/.launch-promo/review-20261020');await mkdir(review,{recursive:true,mode:0o700});
 for(const pilot of creativePilots){
  const root=path.resolve('public/daily-launch/pilots',pilot.id),file=path.join(root,'manifest.json'),raw=await readFile(file,'utf8'),sequence=JSON.parse(raw) as TgPromoSequence;
  const words=punctuateSpeechWordAnchors(sequence.cues.map(c=>c.text),sequence.words),audio=await readFile(path.join(root,'audio.wav'));
  await writeFile(path.join(review,pilot.id+'-before.json'),raw,{flag:'wx',mode:0o600}).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='EEXIST')throw e;});
  sequence.words=words;
  for(const scene of sequence.scenes){const source=pilot.scenes.find(s=>s.id===scene.id);if(source&&'speakerNames' in source)scene.speakerNames=source.speakerNames;}
  await writeFile(file,JSON.stringify(sequence,null,2)+'\n');
  console.log(JSON.stringify({id:pilot.id,anchors:words.length,audioSha256:createHash('sha256').update(audio).digest('hex'),providerCalls:0}));
 }
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Caption refinement failed');process.exitCode=1;});
