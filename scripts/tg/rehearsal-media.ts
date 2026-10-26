/** Real media on a file-only rehearsal, after the user confirms the exact text.
 * No database writes, website uploader, social client or scheduler is imported. */
import {readFile,writeFile,rename,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import mongoose from 'mongoose';
import {editorialWorkspace,REHEARSAL_EXTRA_DOMAINS} from '../../src/lib/tg/rehearsal';
import {TG_SEARCH_DOMAINS} from '../../src/lib/tg/sources';
import {localEditionDate} from '../../src/lib/tg/schedule';
import {createManualTextApproval,manualTextApprovalIsCurrent} from '../../src/lib/tg/text-approval';
import {scriptDigest} from '../../src/lib/tg/editorial';
import {scoredNarration} from '../../src/lib/tg/script-review';
import {connectToDatabase} from '../../src/lib/mongodb';
import {loadPublishedHistory} from '../../src/lib/tg/history';
import {evidenceMemo} from '../../src/lib/tg/evidence-cache';
import {retrieveAuditEvidence,writeEdition,judgeEdition,reviewEditionScript} from '../../src/lib/tg/agents';
import {produceTg} from '../../src/lib/tg/pipeline';
import {saveEditionTexts} from '../../src/lib/tg/edition-text-files';
import {synthesize,renderMedia} from '../../src/lib/tg/media';
import {reviewFinalVideo} from '../../src/lib/tg/final-review';
import {alex2Config,alex2ConfigDigest} from '../../src/lib/tg/alex2-config';
import {macRenderServer} from './mac-render-server.mjs';
import type {TgJob,TgResearch,TgScript} from '../../src/lib/tg/types';

const args=process.argv.slice(2),option=(key:string)=>args.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
let phase='initializing';
async function main(){
 if(process.env.TG_PUBLISH_ENABLED!=='false')throw Error('La prova richiede pubblicazione esplicitamente disabilitata');
 const id=option('rehearsal');if(!id)throw Error('Indicare la sessione privata con --rehearsal');
 const date=localEditionDate(new Date(),'Europe/Rome'),workspace=editorialWorkspace(process.cwd(),date,id),{directory}=workspace;
 const isolation=JSON.parse(await readFile(path.join(directory,'isolation.json'),'utf8'));
 const job=JSON.parse(await readFile(path.join(directory,'session.json'),'utf8')) as TgJob;
 if(isolation.kind!=='private-rehearsal'||isolation.date!==date||isolation.rehearsal!==id||isolation.registeredInDatabase!==false||isolation.publicationEligible!==false
  ||job.date!==date||job.edition!=='it'||job.product.enabled||job.product.productionMode!=='full'||job.product.textReviewMode!=='manual'||job.deliveries.length||job.sitePublication)throw Error('Sessione non isolata: nessuna produzione');
 const scheduleSha256=createHash('sha256').update(await readFile('config/tg/daily-agent.json')).digest('hex');
 if(scheduleSha256!==isolation.productionScheduleSha256)throw Error('Configurazione di produzione cambiata: verificare l’isolamento prima della prova');
 if(args.includes('--dry-run'))return console.log(JSON.stringify({kind:'private-rehearsal',date,rehearsal:id,state:job.state,
  scriptSha256:job.script?scriptDigest(job.script):undefined,reviewInputSha256:job.scriptReview?.inputSha256,manualConfirmationRequired:!manualTextApprovalIsCurrent(job),
  registeredInDatabase:false,publicationEligible:false,scheduleUnchanged:true,providerGeneration:false,reviewDocument:workspace.reviewDocument}));
 if(process.env.PODCAST_SPEECH_ENABLED!=='true'||process.env.TG_EDITORIAL_ONLY==='true')throw Error('Fase media non abilitata nel solo processo di prova');
 for(const domain of REHEARSAL_EXTRA_DOMAINS)if(!TG_SEARCH_DOMAINS.includes(domain))TG_SEARCH_DOMAINS.push(domain);
 process.env.TG_ARTIFACT_DIR=workspace.artifactDirectory;
 async function save(){
  await writeFile(path.join(directory,'session.json.partial'),JSON.stringify(job,null,2)+'\n',{mode:0o600});
  await rename(path.join(directory,'session.json.partial'),path.join(directory,'session.json'));
  await writeFile(path.join(directory,`revision-${job.revision}.json`),JSON.stringify(job,null,2)+'\n',{mode:0o600});
 }
 if(args.includes('--confirm-text')){
  job.textApproval=createManualTextApproval(job,{confirmed:true,reviewer:option('reviewer'),scriptSha256:option('script-sha256'),reviewInputSha256:option('review-input-sha256')});
  job.revision=(job.revision??0)+1;job.events.push({at:new Date().toISOString(),stage:'editorial_ready',detail:`Conferma esplicita del testo della prova privata da ${job.textApproval.reviewer}; nessuna pubblicazione autorizzata`});await save();
 }
 if(!manualTextApprovalIsCurrent(job))throw Error('Manca la conferma esplicita dell’utente su testo e score correnti');
 const model=JSON.parse(await readFile(path.join(directory,'review-model.json'),'utf8'));process.env.PODCAST_OPENAI_MODEL=model.model;
 await connectToDatabase();const history=await loadPublishedHistory(job.edition,date,new Date());
 const lookup=evidenceMemo(),cache=new Map<string,Promise<Awaited<ReturnType<typeof retrieveAuditEvidence>>>>(),signal=AbortSignal.timeout(45*60000);
 const evidence=(r:TgResearch,s:TgScript,verify=false)=>{
  const key=createHash('sha256').update(JSON.stringify({r,s,bucket:Math.floor(Date.now()/1800000)})).digest('hex');
  if(verify||!cache.has(key))cache.set(key,retrieveAuditEvidence(r,s,signal,verify?undefined:lookup,verify?'verification':'research'));return cache.get(key)!;
 };
 let renderer:Awaited<ReturnType<typeof macRenderServer>>|undefined;
 try{
  await produceTg(job,JSON.stringify(history),{
   maximumEditorialRepairs:12,
   research:async()=>{throw Error('La prova deve avere una scaletta già verificata');},
   write:(r,feedback)=>writeEdition(job.product,r,signal,feedback,date),
   audit:async(r,s)=>{phase='audit-A';return judgeEdition(job.product,r,s,await evidence(r,s,true),signal,history);},
   reviewScript:async(r,s)=>{phase='review-B';return reviewEditionScript(job.product,date,r,s,await evidence(r,s),signal);},
   editorialReady:async draft=>{await saveEditionTexts(draft);},
   voiceConfigurationSha256:()=>alex2ConfigDigest(alex2Config()),
   voice:(r,s)=>{phase='voice';return synthesize(job.id,job.product,date,r,s,signal,{textApproval:job.textApproval});},
   render:async manifest=>{
    phase='rendering';renderer??=await macRenderServer();process.env.TG_RENDER_ORIGIN=renderer.origin;process.env.TG_RENDER_PATH='/__cdaily-render__/';
    try{await access('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');process.env.TG_CHROME_CHANNEL='chrome';}catch{}
    return renderMedia(job.id,manifest,signal);
   },
   finalReview:async candidate=>{phase='final-review';return reviewFinalVideo(candidate,signal);},
   checkpoint:async(state,data,detail)=>{
    for(const [key,value]of Object.entries(data))if(value===undefined)delete (job as unknown as Record<string,unknown>)[key];
    Object.assign(job,Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined)),{state,revision:(job.revision??0)+1,updatedAt:new Date().toISOString()});
    job.events.push({at:new Date().toISOString(),stage:state,detail});await save();
    console.log(JSON.stringify({state,revision:job.revision,detail}));
   },
  });
  await saveEditionTexts(job);
  const score=job.script?scoredNarration(job.script):undefined;
  if(job.state==='editorial_ready'){
   const previous=await readFile(workspace.reviewDocument,'utf8');
   await writeFile(path.join(directory,`previous-review-${createHash('sha256').update(previous).digest('hex')}.md`),previous,{mode:0o600});
   const pack=await saveEditionTexts(job);await writeFile(workspace.reviewDocument,await readFile(path.join(pack.directory,'edition-dossier.md')),{mode:0o600});
  }
  const result={kind:'private-rehearsal',date,rehearsal:id,state:job.state,issues:job.issues,scriptSha256:job.script?scriptDigest(job.script):undefined,
   words:score?.narrationText.split(/\s+/u).length,seconds:job.manifest?.seconds,finalReviewPassed:job.finalReview?.passed??false,
   registeredInDatabase:false,publicationEligible:false,videoUploaded:false,assets:job.assets.map(a=>({name:a.name,path:path.join(workspace.artifactDirectory!,job.id,a.name),sha256:a.sha256,bytes:a.bytes}))};
  await writeFile(path.join(directory,'media-result.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));
 }finally{await renderer?.close();}
}
main().catch(error=>{console.error(JSON.stringify({phase,state:'blocked',issue:error instanceof Error?error.message:'Prova incompleta',publication:false}));process.exitCode=1;}).finally(()=>mongoose.disconnect());
