/** Private text workshop: evidence -> exact copy -> A/B -> USER confirmation.
 * It has no media or publication ports. Broadcast runs/counters are untouched. */
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';
import mongoose from 'mongoose';
import {connectToDatabase} from '../../src/lib/mongodb';
import {parseAgentSchedule} from '../../src/lib/tg/agent-schedule';
import {localEditionDate} from '../../src/lib/tg/schedule';
import {researchEdition,retrieveAuditEvidence,writeEdition,judgeEdition,reviewEditionScript,corroborateResearch} from '../../src/lib/tg/agents';
import {requireDailyCoverage,scriptDigest,TgEditorialError,validateResearch,validateScript,requireEditorialScore,withDailyClosing} from '../../src/lib/tg/editorial';
import {produceTg} from '../../src/lib/tg/pipeline';
import {saveEditionTexts} from '../../src/lib/tg/edition-text-files';
import {loadPublishedHistory} from '../../src/lib/tg/history';
import {scoredNarration} from '../../src/lib/tg/script-review';
import {verifyScientificReferences} from '../../src/lib/tg/scientific-references';
import {EVIDENCE_CACHE_WINDOW_MS} from '../../src/lib/tg/evidence-cache';
import {auditIsCurrent} from '../../src/lib/tg/review';
import {editorialWorkspace,rehearsalProduct,REHEARSAL_EXTRA_DOMAINS} from '../../src/lib/tg/rehearsal';
import {TG_SEARCH_DOMAINS} from '../../src/lib/tg/sources';
import type {TgJob,TgResearch,TgScript} from '../../src/lib/tg/types';

const now=new Date(),date=localEditionDate(now,'Europe/Rome');
const rehearsal=process.argv.find(a=>a.startsWith('--rehearsal='))?.slice(12);
const workspace=editorialWorkspace(process.cwd(),date,rehearsal),{directory}=workspace;
const signal=AbortSignal.timeout(40*60000);
let stage='initializing';
let reviewModel=process.env.PODCAST_OPENAI_MODEL||process.env.OPENAI_MEETING_MODEL||'gpt-5.4-mini';
async function json<T>(name:string,value?:T):Promise<T>{
 const file=path.join(directory,name+'.json');
 if(value===undefined)return JSON.parse(await readFile(file,'utf8'));
 await writeFile(file+'.partial',JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(file+'.partial',file);return value;
}
async function cached<T>(name:string,fn:()=>Promise<T>):Promise<T>{
 try{return await json<T>(name);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await writeFile(path.join(directory,name+'.request.json'),JSON.stringify({at:new Date().toISOString(),stage}),{flag:'wx',mode:0o600});
 try{const result=await fn();return await json(name,result);}
 catch(error){await json(name+'.error',{at:new Date().toISOString(),issue:error instanceof Error?error.message:'Request failed'});throw error;}
}
type Evidence=Awaited<ReturnType<typeof retrieveAuditEvidence>>;
const retrieve=(research:TgResearch,script:TgScript)=>retrieveAuditEvidence(research,script,signal,(key,generate)=>cached('evidence-story-v1-'+key,generate));
let activeProduct:import('../../src/lib/tg/types').TgProduct|undefined;
const corroborate=(research:TgResearch,evidence:Evidence)=>corroborateResearch(research,evidence,signal,new Date(),activeProduct);
const reviewDocument=workspace.reviewDocument;
async function saveReviewDocument(content:string){
 await mkdir(path.dirname(reviewDocument),{recursive:true});
 await writeFile(reviewDocument+'.partial',content);await rename(reviewDocument+'.partial',reviewDocument);
}
async function invalidateReviewDelivery(){
 // A failed/new revision must not leave yesterday's positive delivery looking
 // current. Preserve the old readable copy and request as immutable evidence.
 try{
  const previous=await readFile(reviewDocument,'utf8');
  const key=createHash('sha256').update(previous).digest('hex');
  await writeFile(path.join(directory,`previous-readable-${key}.md`),previous,{mode:0o600});
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 try{
  const previous=await json('awaiting-user');
  const key=createHash('sha256').update(JSON.stringify(previous)).digest('hex');
  await json('previous-awaiting-user-'+key,previous);
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await json('awaiting-user',{date,state:'under-review',mediaGenerated:false});
 await saveReviewDocument(`# Conclavia Daily — ${date} — revisione in corso\n\nIl copione corrente è ancora in verifica. Le copie precedenti e i loro rapporti sono conservati privatamente; non costituiscono l’approvazione della revisione corrente. Nessun audio, video o pubblicazione.\n`);
}
function reviewMarkdown(job:TgJob){
 const script=job.script!,score=scoredNarration(script),words=score.narrationText.split(/\s+/u).length;
 const orderedStories=[...new Set(script.sentences.filter(s=>!['intro','outro'].includes(s.storyId)).map(s=>s.storyId))].map(id=>job.research!.stories.find(s=>s.id===id)!);
 const cell=(value:string)=>value.replace(/\|/gu,'\\|').replace(/\s+/gu,' ');
 const duration=(rate:number)=>{const n=Math.round(words/rate*60+4);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
 const intro=script.sentences.filter(s=>s.storyId==='intro').map(s=>s.text).join(' '),outro=script.sentences.filter(s=>s.storyId==='outro').map(s=>s.text).join(' ');
 const sourceAppendix=orderedStories.flatMap((story,i)=>[
  `### ${i+1}. ${story.headline}`,'',
   '**Fonti della notizia — data nel registro**',...job.research!.sources.filter(s=>story.sourceIds.includes(s.id)).map(s=>`- [${s.publisher} — ${s.title}](${s.url}) · ${s.publishedAt.slice(0,10)}`),'',
   '**Riscontri web usati dal controllo A**',
   ...[...new Set(job.audit!.checks?.filter(c=>{
    if(c.key.startsWith('sentence_'))return script.sentences[Number(c.key.slice(9))]?.storyId===story.id;
    if(c.key.startsWith('headline_'))return script.headlines?.[Number(c.key.slice(9))]?.storyId===story.id;
    return false;
   }).flatMap(c=>c.sourceUrls)??[])].filter(url=>!job.research!.sources.some(s=>s.url===url)).map(url=>`- [${job.audit!.sources.find(s=>s.url===url)?.title??new URL(url).hostname}](${url})`),'',
 ]);
 const markdown=[`# Conclavia Daily — ${date} — testo da approvare`,'',
  '**Stato: controlli AI A/B superati; approvazione manuale dell’utente ancora da ricevere. Nessun audio, video o pubblicazione.**','',
  `Titolo dell’edizione: **${script.title}**.`,'',
  `Copione: ${words} parole. Stima di lettura ${duration(180)}–${duration(150)}; la durata reale verrà misurata nell’audio e dovrà essere inferiore a dieci minuti.`,
  `Versione testo: ${scriptDigest(script)}. Cutoff raccolta: ${job.research!.collectedAt}.`,'',
  '## Apertura','',intro,'','[Pausa di regia: due secondi silenziosi. Questa istruzione non viene pronunciata.]','',
  ...script.sentences.filter(s=>!['intro','outro'].includes(s.storyId)).flatMap((sentence,i,body)=>{
   const story=orderedStories.find(s=>s.id===sentence.storyId)!;
   const heading=i===0||body[i-1].storyId!==sentence.storyId
    ?[`## ${orderedStories.indexOf(story)+1}. ${script.headlines?.find(h=>h.storyId===story.id)?.title??story.headline}`,'']:[];
   return [...heading,sentence.text,''];
  }),
  '## Chiusura','',outro,'',
  '## Testo social','',script.description,'',
  '## Fonti e riscontri','',...sourceAppendix,
  '## Testi dei cartelli video','',
  '| Notizia | Titolo | Contesto | Sviluppo |','| --- | --- | --- | --- |',
  ...orderedStories.map(story=>{
   const card=script.cards?.find(c=>c.storyId===story.id),headline=script.headlines?.find(h=>h.storyId===story.id);
   return `| ${cell(story.id)} | ${cell(headline?.title??story.headline)} | ${cell(card?.context??'')} | ${cell(card?.change??'')} |`;
  }),'',
  '## Mood e intenzioni, nello stesso ordine del parlato','',
  'La tabella è regia, non testo da leggere. I tempi saranno ricavati dalla voce vera; qui non sono inventati.','',
  '| Frase | Notizia | Mood | Intensità | Intenzione |','| --- | --- | --- | --- | --- |',
  ...script.sentences.map((s,i)=>`| ${i+1} | ${s.storyId} | ${s.mood} | ${s.intensity} | ${s.intent??'quiet'}${s.gestureWord?` · ${s.gestureWord}`:''} |`),'',
  'Il planner corporeo condiviso alterna gesti di spiegazione, confronto, accento e pause con mani raccolte; coordina spalle, busto, collo, polsi e dita. Tocco al mento e palmi uniti sono accenti occasionali legati al significato. Niente intreccio in piedi, sorriso sulle tragedie o gesto su ogni frase. Il solo puntamento obbligatorio è verso i commenti in chiusura, sulla parola misurata “commenti”.','',
  '## Rapporti di controllo','',`A: ${job.audit!.checkedAt}. B: ${job.scriptReview!.checkedAt}. Entrambi positivi e legati a questo testo.`,
  'Ogni modifica al parlato, ai mood o alle intenzioni richiede una nuova verifica. Il tuo OK è il passaggio successivo; il presente documento non lo sostituisce.','',
  '## Scelte di questa revisione','',
  ...job.research!.warnings.map(w=>`- ${w}`),'',
  ...orderedStories.flatMap(s=>[`**${s.headline}**: ${s.whyItMatters}`,'']),
  '## Score tecnico congelato','',
  'Questi marcatori vengono letti dal motore, non dalla voce. I tempi saranno misurati soltanto dopo la conferma del testo.','',
  '```xml',score.scoreMarkup,'```','',
 ].join('\n');
 const readable=markdown.split('## Testo social')[0];let cursor=0;
 for(const sentence of script.sentences){
  const at=readable.indexOf(sentence.text,cursor);
  if(at<0)throw Error('Readable review must preserve every spoken clause in its actual order');
  cursor=at+sentence.text.length;
 }
 return markdown;
}
async function main(){
 if(process.env.TG_PUBLISH_ENABLED!=='false'||process.env.PODCAST_SPEECH_ENABLED!=='false')throw Error('Text workshop requires speech/publication explicitly disabled');
 await mkdir(directory,{recursive:true,mode:0o700});
 if(rehearsal)for(const domain of REHEARSAL_EXTRA_DOMAINS)if(!TG_SEARCH_DOMAINS.includes(domain))TG_SEARCH_DOMAINS.push(domain);
 process.env.TG_RESEARCH_TRACE_DIR=path.join(directory,'research-trace');
 const plan=parseAgentSchedule(JSON.parse(await readFile('config/tg/daily-agent.json','utf8')));
 let product=rehearsal?rehearsalProduct(plan.product,now):{...plan.product,productionMode:'editorial' as const,textReviewMode:'manual' as const};
 if(workspace.artifactDirectory)process.env.TG_ARTIFACT_DIR=workspace.artifactDirectory;
 reviewModel=plan.editorialModel||reviewModel;process.env.PODCAST_OPENAI_MODEL=reviewModel;
 await json('review-model',{model:reviewModel,at:new Date().toISOString(),scope:'this-private-editorial-process'});
 await connectToDatabase();
 const history=await loadPublishedHistory(product.edition,date,now);
 if(rehearsal){
  await json('published-history-readonly',history);
  await cached('isolation',async()=>({version:1,kind:'private-rehearsal',date,rehearsal,at:now.toISOString(),registeredInDatabase:false,publicationEligible:false,newsMemoryWrites:false,scheduleWrites:false,extraSearchDomains:REHEARSAL_EXTRA_DOMAINS,
   productionScheduleSha256:createHash('sha256').update(await readFile('config/tg/daily-agent.json')).digest('hex')}));
 }
 let job:TgJob|undefined;
 try{job=await json<TgJob>('session');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 if(rehearsal&&job)product=job.product; // A resumed rehearsal keeps its own frozen window.
 activeProduct=product;
  const revisionFile=process.argv.slice(2).find(a=>!a.startsWith('--'));
 if(revisionFile){
  if(!job)throw Error('An editorial revision requires the preserved original session');
  const file=path.resolve(revisionFile);
  if(!file.startsWith(directory+path.sep))throw Error('Editorial revision must be inside the private dated workshop');
  const revision=JSON.parse(await readFile(file,'utf8')) as {research:TgResearch;script?:TgScript;note:string};
  const key=createHash('sha256').update(JSON.stringify({revision,editorialProfile:product.editorialProfile,sourcePolicyVersion:2})).digest('hex');
  if(!job.events.some(e=>e.detail.includes(key))){
   await invalidateReviewDelivery();
   const allowed=new Set(revision.research.sources.map(s=>s.url));
   const research=validateResearch(revision.research,allowed,new Date(),new Map(revision.research.sources.map(s=>[s.url,s.independentGroup])),{candidatePool:product.editorialProfile!==undefined});
   const briefing:TgScript={title:'Revisione della selezione',description:'',sentences:research.stories.flatMap(s=>s.facts.map(f=>({text:f.text,storyId:s.id,sourceIds:f.sourceIds,speaker:0 as const,mood:'attention' as const,intensity:.3})))};
   const unchangedResearch=JSON.stringify(revision.research)===JSON.stringify(job.research);
   stage='revised-evidence';const evidence=unchangedResearch?await json<Evidence>('evidence'):await cached('evidence-'+key,()=>retrieve(research,briefing));
   stage='revised-source-review';const checked=unchangedResearch?{research:job.research!,review:{checks:{}}}:await cached('source-review-'+key,()=>corroborate(research,evidence));
   await json('selection-'+key,checked);requireDailyCoverage(product,checked.research);
   await json('revision-'+(job.revision??0),job);
   job.research=checked.research;delete job.script;delete job.audit;delete job.scriptReview;delete job.textApproval;
   if(revision.script){
    const normalized=withDailyClosing(revision.script,product.language,'reviewed');
    job.script=validateScript(normalized,product,job.research);
    requireEditorialScore({sentences:job.script.sentences.filter(s=>s.storyId!=='outro')});
   }
   job.state='writing';job.revision=(job.revision??0)+1;
   job.events.push({at:new Date().toISOString(),stage:'writing',detail:`Revisione della selezione ${key}: ${revision.note}. Tutti i precedenti tentativi conservati; nuovi controlli A/B obbligatori.`});
   await json('evidence',evidence);await json('session',job);
  }
 }
 if(job?.state==='editorial_ready'&&auditIsCurrent(job,new Date())&&!process.argv.includes('--verify-references')){
  await saveReviewDocument(reviewMarkdown(job));
  await json('awaiting-user',{date,scriptSha256:scriptDigest(job.script!),state:'awaiting-user',mediaGenerated:false});
  return console.log(JSON.stringify({state:'awaiting-user',date,words:scoredNarration(job.script!).narrationText.split(/\s+/u).length,document:reviewDocument,mediaGenerated:false}));
 }
 await invalidateReviewDelivery();
 if(!job){
  let research:TgResearch|undefined,feedback='Prefer six to eight well corroborated items across Italian public life, economy, society and knowledge. Exclude routine forecasts, celebrity schedules and filler. A major global exception is allowed, but do not invent its Italian impact.';
  for(let attempt=1;attempt<=3&&!research;attempt++){
   try{
    stage=`research-${attempt}`;
    const candidate=await cached(stage,()=>researchEdition(product,new Date(),JSON.stringify(history),signal,feedback));
    const briefing:TgScript={title:'Materiale di ricerca',description:'',sentences:candidate.stories.flatMap(s=>s.facts.map(f=>({text:f.text,storyId:s.id,sourceIds:f.sourceIds,speaker:0 as const,mood:'attention' as const,intensity:.3})))};
    stage=`evidence-${attempt}`;const evidence=await cached(stage,()=>retrieve(candidate,briefing));
    stage=`source-review-${attempt}`;const checked=await cached(stage,()=>corroborate(candidate,evidence));
    await json(`selection-${attempt}`,checked);
    feedback=JSON.stringify(checked.review);
    requireDailyCoverage(product,checked.research);research=checked.research;
    await json('evidence',evidence);
   }catch(error){
    await json(`research-${attempt}-outcome`,{issue:error instanceof Error?error.message:'Research failed'});
    if(!(error instanceof TgEditorialError))throw error;
    feedback+='\nActual blocking issue: '+error.message;
   }
  }
  if(!research)throw Error('No adequately corroborated selection after the bounded research correction');
  job={id:randomBytes(12).toString('hex'),date,edition:product.edition,product,research,state:'queued',assets:[],issues:[],events:[],deliveries:[],attempts:1,revision:0,editorialRepairs:0,durationRepairs:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await json('session',job);
 }
 const current=job;let evidence=await json<Evidence>('evidence');
 if(process.argv.includes('--verify-references')){
  const checked=await Promise.all(evidence.data.map(d=>verifyScientificReferences(d,signal)));
  const data=checked.map(c=>c.item),rejected=checked.flatMap(c=>c.rejected);
  if(rejected.length){
   const key=createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
   await json('evidence-before-reference-check-'+key,evidence);await json('reference-identity-check',rejected);
   evidence={data,sources:[...new Map(data.flatMap(d=>d.sources).map(s=>[s.url,s])).values()],webByStory:Object.fromEntries(data.map(d=>[d.storyId,d.sources.map(s=>s.url)]))};
   await json('evidence',evidence);delete current.research!.retrievedContext;delete current.audit;delete current.scriptReview;delete current.textApproval;
   current.state='verifying';current.revision=(current.revision??0)+1;
   current.events.push({at:new Date().toISOString(),stage:'verifying',detail:'Verifica pubblica dei metadati DOI: riferimenti non corrispondenti esclusi, prove precedenti conservate; entrambi i controlli devono ripartire.'});
   await json('session',current);await json('revision-'+current.revision,current);
  }
 }
 if(!current.research!.retrievedContext){
  const known=new Set(current.research!.stories.map(s=>s.id)),allowed=new Set(evidence.sources.map(s=>s.url));
  const data=evidence.data as {storyId:string;brief:unknown;sources:{url:string}[]}[];
  current.research!.retrievedContext=data.filter(item=>known.has(item.storyId)&&typeof item.brief==='string').map(item=>({storyId:item.storyId,brief:String(item.brief).slice(0,8000),sourceUrls:item.sources.map(s=>s.url).filter(url=>allowed.has(url))}));
  delete current.audit;delete current.scriptReview;current.revision=(current.revision??0)+1;
  current.events.push({at:new Date().toISOString(),stage:'writing',detail:'Aggiunto il contesto realmente recuperato alle prove visibili al writer; revisioni e limiti precedenti conservati, nuovi controlli A/B obbligatori.'});
  await json('session',current);await json('revision-'+current.revision,current);
 }
 const spokenEvidence=new Map<string,Promise<Evidence>>();
 const evidenceForScript=(research:TgResearch,script:TgScript)=>{
  const key=createHash('sha256').update(JSON.stringify({version:9,reviewModel,retrievalModel:process.env.TG_RESEARCH_MODEL||reviewModel,date,research,script,window:Math.floor(Date.now()/EVIDENCE_CACHE_WINDOW_MS)})).digest('hex');
  if(!spokenEvidence.has(key))spokenEvidence.set(key,retrieve(research,script).then(value=>json('spoken-evidence-v9-'+createHash('sha256').update(JSON.stringify(value)).digest('hex'),value)));
  return spokenEvidence.get(key)!;
 };
 await produceTg(current,JSON.stringify(history),{
  editorialOnly:true,
  maximumEditorialRepairs:12,
  research:async()=>current.research!,
  write:async(research,feedback)=>{
   stage='writing';const key=createHash('sha256').update(JSON.stringify({research,feedback,date,product})).digest('hex');
   return cached(`writer-${key}`,()=>writeEdition(product,research,signal,feedback,date));
  },
  audit:async(research,script)=>{stage='audit-A';const live=await evidenceForScript(research,script),digest=createHash('sha256').update(JSON.stringify({version:9,reviewModel,date,product,research,script,evidence:live,history})).digest('hex');return cached('audit-v9-'+digest,()=>judgeEdition(product,research,script,live,signal,history,new Date(),(key,generate)=>cached(`audit-part-v9-${digest}-${key}`,generate)));},
  reviewScript:async(research,script)=>{stage='review-B';const live=await evidenceForScript(research,script),digest=createHash('sha256').update(JSON.stringify({version:9,reviewModel,date,product,research,script,evidence:live})).digest('hex');return cached('review-v9-'+digest,()=>reviewEditionScript(product,date,research,script,live,signal));},
  editorialReady:async draft=>{await saveEditionTexts(draft);},
  voice:async()=>{throw Error('NO_MEDIA_PORT');},render:async()=>{throw Error('NO_MEDIA_PORT');},
  checkpoint:async(state,data,detail)=>{
   for(const [key,value]of Object.entries(data))if(value===undefined)delete (current as unknown as Record<string,unknown>)[key];
   Object.assign(current,Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined)),{state,updatedAt:new Date().toISOString(),revision:(current.revision??0)+1});
   current.events.push({at:new Date().toISOString(),stage:state,detail});
   await json('session',current);await json('revision-'+current.revision,current);
   console.log(JSON.stringify({state,revision:current.revision,detail}));
  },
 });
 if(current.state!=='editorial_ready')return console.log(JSON.stringify({state:current.state,issues:current.issues,mediaGenerated:false}));
 await saveReviewDocument(reviewMarkdown(current));
 await json('awaiting-user',{date,scriptSha256:scriptDigest(current.script!),state:'awaiting-user',mediaGenerated:false});
 console.log(JSON.stringify({state:'awaiting-user',document:reviewDocument,words:scoredNarration(current.script!).narrationText.split(/\s+/u).length,stories:current.research!.stories.length,mediaGenerated:false}));
}
main().catch(async error=>{
 await mkdir(directory,{recursive:true,mode:0o700});
 const issue=error instanceof Error?error.message:'Editorial workshop failed',at=new Date().toISOString();
 await json('last-error',{stage,at,issue});
 try{
  const job=await json<TgJob>('session');await json('before-error-'+(job.revision??0),job);
  job.state='blocked';job.revision=(job.revision??0)+1;job.updatedAt=at;job.issues=[issue];
  job.events.push({at,stage:'blocked',detail:`Errore tecnico durante ${stage}: ${issue}. Nessun controllo positivo implicito; revisioni precedenti conservate.`});
  await json('session',job);await json('revision-'+job.revision,job);
 }catch(failure){if((failure as NodeJS.ErrnoException).code!=='ENOENT')throw failure;}
 await json('awaiting-user',{date,state:'blocked',stage,issue,mediaGenerated:false});
 await saveReviewDocument(`# Conclavia Daily — ${date} — verifica sospesa\n\n${issue}\n\nIl controllo ${stage} non è completato: il testo non è approvato. Nessun audio, video o pubblicazione. Le prove e le stesure precedenti restano conservate privatamente.\n`);
 console.error(JSON.stringify({stage,state:'blocked',issue,mediaGenerated:false}));process.exitCode=1;
}).finally(()=>mongoose.disconnect());
