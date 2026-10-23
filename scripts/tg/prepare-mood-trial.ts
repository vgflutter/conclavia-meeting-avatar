/** Explicit bounded creative trial. Does not run from the worker or tests. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {TgRunModel} from '../../src/models/tg/TgRun';
import {jobDirectory} from '../../src/lib/tg/artifacts';
import {writeEdition} from '../../src/lib/tg/agents';
import {validateScript,sentenceDigest} from '../../src/lib/tg/editorial';
import {synthesize,renderMedia} from '../../src/lib/tg/media';
import {tgSpeechPassages} from '../../src/lib/tg/speech-plan';
import {TG_PRODUCTS,localEditionDate} from '../../src/lib/tg/config';
import type {TgResearch,TgScript,TgManifest} from '../../src/lib/tg/types';

async function main(){
  const id=process.argv.find(a=>a.startsWith('--id='))?.slice(5),phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8);
  if(!process.argv.includes('--confirm')||!id||!/^[a-f0-9]{24}$/u.test(id)||!['script','voice','render'].includes(phase??'')||process.env.MONGODB_URI!=='mongodb://127.0.0.1:27018'||process.env.MONGODB_DB_NAME!=='conclavia_e2e_podcast_preview'||process.env.TG_PUBLISH_ENABLED!=='false')throw Error('Explicit isolated local mood trial required');
  const now=new Date(),product={...TG_PRODUCTS[0],name:'Conclavia Daily · prova quattro notizie',seconds:120,presenters:1 as const,enabled:false,automatic:false},date=localEditionDate(now,product.timezone);
  const research=JSON.parse(await readFile('scripts/tg/fixtures/mood-trial-research.json','utf8')) as TgResearch;research.collectedAt=now.toISOString();
  if(research.stories.length!==4)throw Error('Four source stories required');
  const dir=jobDirectory(id);await mkdir(dir,{recursive:true,mode:0o700});
  const scriptFile=path.join(dir,'.mood-score.json');let script:TgScript;
  const revise=process.argv.includes('--revise');
  if(revise){if(phase!=='script')throw Error('Revision is for the script phase only');await writeFile(path.join(dir,'.mood-score-first.json'),await readFile(scriptFile),{flag:'wx',mode:0o600});}
  try{if(revise)throw Error('Editorial revision requested');script=validateScript(JSON.parse(await readFile(scriptFile,'utf8')),product,research);}
  catch{
    if(phase!=='script')throw Error('Prepare and review the script first');
    script=await writeEdition(product,research,AbortSignal.timeout(180000),'Cover ALL FOUR source stories, in their supplied editorial order (NOT chronological order). 200–230 Italian words TOTAL. One host. Write a finished audience-facing Conclavia Daily, not a technical test narration: a brief warm brand opening, then four engaging stories and a short brand closing. Do not speak about tests, rehearsals, cards, synthetic editorial voices, providers or generation. AI disclosure stays only in the description. These are recent stories from October 15–19, not all events of today. 2–4 meaningful emotion segments per story, at least two moods where justified. At least one grammatical sentence must continue across two mood segments at a comma/conjunction. Appropriate suggested score: serious opening attention → empathy (care about those injured, no invented detail); birds curiosity → surprise at energy savings → doubt about weather limitations; medieval roof curiosity → surprise at old engineering → agreement/appreciation; photography warm attention → agreement, with only a restrained amused smile if the text naturally invites it. Aim for at least six distinct appropriate moods overall, without forced anger or jokes about suffering. Keep emotional intensity readable but adult and restrained, around 0.6–0.85. First dated report numbers are not final figures. No invented context, extra facts, advice, statistics or consequences. Spell spoken numbers in Italian words. Prefer a natural Italian description over long English competition names. Be conversational, with concrete facts and connected phrasing, not an institutional press-release list.');
    await writeFile(scriptFile,JSON.stringify(script,null,2),{mode:0o600});
  }
  const covered=new Set(script.sentences.filter(s=>!['intro','outro'].includes(s.storyId)).map(s=>s.storyId));
  if(covered.size!==4||script.sentences.some(s=>s.speaker!==0)||tgSpeechPassages(script.sentences).length>8)throw Error('Trial exceeds four stories, one speaker or eight synthesis requests');
  console.log(JSON.stringify({stage:'score',id,stories:covered.size,segments:script.sentences.length,passages:tgSpeechPassages(script.sentences).length,moods:[...new Set(script.sentences.map(s=>s.mood))],words:script.sentences.reduce((n,s)=>n+s.text.split(/\s+/u).length,0)}));
  if(phase==='script')return;
  const manifestFile=path.join(dir,'.mood-manifest.json');let manifest:TgManifest;
  if(phase==='voice'){
    manifest=await synthesize(id,product,date,research,script,AbortSignal.timeout(600000),{naturalDuration:true});manifest.demo=true;
    await writeFile(manifestFile,JSON.stringify(manifest),{mode:0o600});
    console.log(JSON.stringify({stage:'voice',id,seconds:manifest.seconds,voices:manifest.speech?.voices,alignment:manifest.cues.map(c=>({story:c.storyId,mood:c.mood,start:c.start,end:c.end,timing:c.alignment}))}));return;
  }
  manifest=JSON.parse(await readFile(manifestFile,'utf8')) as TgManifest;
  if(manifest.date!==date||sentenceDigest(manifest.cues)!==sentenceDigest(script.sentences))throw Error('Voice checkpoint does not match the reviewed script or date');
  await connectToDatabase();
  if(await TgRunModel.exists({$or:[{_id:id},{edition:'it',date}]}))throw Error('An edition already exists; preserve it instead of replacing it');
  const assets=await renderMedia(id,manifest,AbortSignal.timeout(900000));
  await TgRunModel.create({_id:id,edition:'it',date,state:'needs_review',product:manifest.product,research,script,manifest,assets,revision:0,attempts:1,issues:[],deliveries:[],events:[{at:new Date().toISOString(),stage:'needs_review',detail:'Prova italiana con quattro notizie recenti e mood per frase/proposizione. Gianni, letture continue, durata naturale. Fonti consultate; revisione editoriale AI e approvazione ancora da completare. Nessuna distribuzione.'}]});
  console.log(JSON.stringify({stage:'complete',id,seconds:manifest.seconds,state:'needs_review',url:`http://127.0.0.1:3105/podcast/tg/redazione?job=${id}`}));
}
void main().catch(()=>{console.error('Preparazione della prova interrotta. Checkpoint conservati; nessuna pubblicazione.');process.exitCode=1;}).finally(()=>mongoose.disconnect());
