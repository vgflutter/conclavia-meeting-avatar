/** Offline handoff and payload measurement. No environment file, DB, fetch,
 * model, speech, renderer or publication adapter is loaded by this command. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseAgentSchedule} from '../../src/lib/tg/agent-schedule';
import {localEditionDate} from '../../src/lib/tg/schedule';
import {TG_FEEDS} from '../../src/lib/tg/sources';
import {dailyGreeting,dailyClosing,auditTargets,auditSchema,scriptDigest} from '../../src/lib/tg/editorial';
import {DAILY_OPENING_PAUSE_SECONDS} from '../../src/lib/tg/opening-pause';
import {factAuditBatches,factBatchContext} from '../../src/lib/tg/audit-context';
import type {TgJob} from '../../src/lib/tg/types';
import type {TgAuditEvidence} from '../../src/lib/tg/evidence-cache';

async function main(){
 const plan=parseAgentSchedule(JSON.parse(await readFile('config/tg/daily-agent.json','utf8')));
 const product=plan.product,date=localEditionDate(new Date(),product.timezone);
 const directory=path.resolve('.tg-artifacts/context',date);await mkdir(directory,{recursive:true,mode:0o700});
 const policy=await readFile('docs/tg/cdaily-editorial-standard-20261025.md','utf8');
 const feeds=TG_FEEDS.filter(f=>f.edition===product.edition);
 const context={version:1,date,edition:product.edition,timezone:product.timezone,productionTime:product.productionTime,
  editorialProfile:product.editorialProfile,productionMode:product.productionMode??'full',textReviewMode:product.textReviewMode??'ai',model:plan.editorialModel,
  policySha256:createHash('sha256').update(policy).digest('hex'),
  opening:dailyGreeting(product.language,date,'reviewed'),openingPauseSeconds:DAILY_OPENING_PAUSE_SECONDS,
  closing:dailyClosing(product.language,'reviewed').map(s=>({text:s.text,mood:s.mood,intent:s.intent,gestureWord:s.gestureWord})),
  catalog:{feeds:feeds.length,originGroups:new Set(feeds.map(f=>f.group)).size},
  status:'local configuration preview; no news collected, facts checked or approval issued'};
 const markdown=[`# Daily — contesto locale ${date}`,'',
  'Anteprima locale dal file di configurazione; non prova lo stato del backend né l’esito dei controlli editoriali. Nessuna chiamata a provider, rete o database.','',
  `Edizione: ${product.edition}. Fuso: ${product.timezone}. Avvio Mac: ${product.productionTime}. Percorso: ${context.productionMode}. Verifica testo: ${context.textReviewMode}.`,
  `Catalogo: ${context.catalog.feeds} feed, ${context.catalog.originGroups} gruppi dichiarati. I controlli sul singolo fatto devono verificare anche eventuale sindacazione.`,'',
  '## Testo fisso generato dal codice','',context.opening,'',
  `Pausa di regia: ${DAILY_OPENING_PAUSE_SECONDS} secondi, da misurare dopo il consenso ai media. Non pronunciarla.`,'',
  context.closing.map(s=>s.text).join(' '),'',
  '## Contratto per questa edizione','',
  '- Italia al centro; estero solo con impatto italiano verificato o eccezione mondiale motivata. World è un prodotto distinto.',
  '- Profilo italia-morning-v2: obiettivo 5–7 minuti, almeno sei notizie, normalmente 6–8 e massimo nove. Master minimo 4:30 e inferiore a 10:00. Bacino di riserva prima della selezione; nessun riempitivo.',
  '- Spiegare protagonisti, sviluppo nuovo e contesto per non esperti. Fatti, dichiarazioni e incertezze distinti; nessuna promessa di imparzialità infallibile.',
  '- Sviluppo nelle ultime 24 ore, riscontri entro 36 ore e confronto con l’archivio realmente pubblicato. Evoluzioni ammesse; vecchi fatti non diventano nuovi cambiando data.',
  '- Ogni clausola conserva text, mood, intensity, intent, speaker, storyId e sourceIds. Il planner sceglie gesti variati o quiete; nessuna posa fissa per categoria di notizia.',
  '- Un solo puntamento verso i commenti in chiusura. Tempi, labiale e durata reale dipendono dall’audio futuro.',
  '- Scrittura + sintesi social in un solo passaggio, poi A (fatti/attualità) e B (rilettura completa separata). manual aggiunge il tuo OK; ai conserva A/B e prosegue.',
  '- Non copiare notizie, mood o prove di ieri nel copione di oggi. Riutilizzare funzioni, schemi e controlli; ogni fatto nuovo richiede prove odierne.',
  '- Audio e video sono fuori dal lavoro di preparazione locale. Nessun cambio a voce Alex 2, identità o studio approvati.','',
  '## Riferimenti da aprire solo per il passaggio necessario','',
  '- Entrata rapida: docs/tg/cdaily-quick-start.md.',
  '- Regole complete: docs/tg/cdaily-editorial-standard-20261025.md.',
  '- Produzione e problemi operativi: docs/tg/cdaily-agent-runbook.md.',
  '- Per preparare il testo usare il flusso esistente; questo comando non crea una puntata.',
  `- Fingerprint delle regole: ${context.policySha256}.`,'',
 ].join('\n');
 for(const [name,value] of [['agent-context.md',markdown],['agent-context.json',JSON.stringify(context,null,2)+'\n']]){
  const file=path.join(directory,name);await writeFile(file+'.partial',value,{mode:0o600});await rename(file+'.partial',file);
 }
 let measurement:Record<string,unknown>|undefined;
 const arg=process.argv.indexOf('--measure');
 if(arg>=0){
  const file=path.resolve(process.argv[arg+1]??'');
  if(!file.startsWith(path.resolve('.tg-artifacts')+path.sep))throw Error('Measurement input must be a private .tg-artifacts session');
  const job=JSON.parse(await readFile(file,'utf8')) as TgJob;
  if(!job.research||!job.script)throw Error('Saved research and script required');
  const evidence=JSON.parse(await readFile(path.join(path.dirname(file),'evidence.json'),'utf8')) as TgAuditEvidence;
  const research={...job.research};delete research.retrievedContext;
  const consulted=[...new Map([...evidence.sources,...research.sources.map(s=>({url:s.url,title:s.title}))].map(s=>[s.url,s])).values()];
  const targets=auditTargets(job.script),batches:{keys:string[];stories:string[];afterCharacters:number}[]=[];let before=0;
  for(let i=0;i<targets.length;i+=4){
   const batch=targets.slice(i,i+4),keys=batch.map(t=>t.key);
   before+=(JSON.stringify(evidence)+JSON.stringify({research,script:job.script,targets:batch,consultedSourceCatalog:consulted})+JSON.stringify(auditSchema(job.script,consulted.map(s=>s.url),keys,evidence.webByStory))).length;
  }
  for(const keys of factAuditBatches(job.script)){
   const c=factBatchContext(research,job.script,evidence,keys);
   const after=JSON.stringify(c.searched)+JSON.stringify({research:c.research,script:c.script,targets:c.targets,consultedSourceCatalog:c.consultedSourceCatalog})+JSON.stringify(auditSchema(job.script,c.consultedSourceCatalog.map(s=>s.url),keys,c.searched.webByStory));
   batches.push({keys,stories:c.storyIds,afterCharacters:after.length});
  }
  const after=batches.reduce((n,b)=>n+b.afterCharacters,0);
  measurement={basis:'offline simulation on saved selection evidence; variable JSON and schemas only, not billed tokens or a new audit',date:job.date,scriptSha256:scriptDigest(job.script),targets:targets.length,beforeRequests:Math.ceil(targets.length/4),afterRequests:batches.length,beforeCharacters:before,afterCharacters:after,reductionPercent:Math.round((1-after/before)*1000)/10,batches};
  await writeFile(path.join(directory,'payload-measurement.json'),JSON.stringify(measurement,null,2)+'\n',{mode:0o600});
 }
 console.log(JSON.stringify({contextFile:path.relative(process.cwd(),path.join(directory,'agent-context.md')),characters:markdown.length,networkCalls:0,providerCalls:0,mediaGenerated:false,...(measurement?{measurement:{basis:measurement.basis,targets:measurement.targets,beforeRequests:measurement.beforeRequests,afterRequests:measurement.afterRequests,beforeCharacters:measurement.beforeCharacters,afterCharacters:measurement.afterCharacters,reductionPercent:measurement.reductionPercent}}:{} )},null,2));
}
main().catch(()=>{console.error('Local context not completed: check the configuration and private input paths. No provider or media was called.');process.exitCode=1;});
