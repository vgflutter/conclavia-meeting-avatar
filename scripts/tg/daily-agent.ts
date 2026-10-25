/** Daily production controller. No secrets in this file or its status output.
 * The existing application runtime loads its own .env.local normally. */
import { readFile, mkdir, writeFile, rename, symlink, readlink, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseAgentSchedule, agentCalendar, agentDecision, type DailyAgentSchedule } from '../../src/lib/tg/agent-schedule';
import { parseProduct } from '../../src/lib/tg/config';
import { localEditionDate } from '../../src/lib/tg/schedule';
import { alex2ConfigStatus } from '../../src/lib/tg/alex2-config';
import { alex2SynthesisVerified } from '../../src/lib/tg/alex2-proof';
import {macProductionStage} from '../../src/lib/tg/mac-production-stage';

class DailyAgentStop extends Error {}
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const stateDir=path.join(root,'.daily-agent');
const args=process.argv.slice(2),command=args[0]??'status';
const dryRun=args.includes('--dry-run');
const output=(value:unknown)=>console.log(JSON.stringify(value,null,2));
const env={...process.env};
const now=new Date();
async function writeState(name:string,value:unknown){
  await mkdir(stateDir,{recursive:true,mode:0o700});
  const file=path.join(stateDir,name),temporary=file+`.${process.pid}.partial`;
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temporary,file);
}
async function localState(name:string){try{return JSON.parse(await readFile(path.join(stateDir,name),'utf8'));}catch{return undefined;}}
async function spawnCommand(file:string,argv:string[],options:{inherit?:boolean;environment?:NodeJS.ProcessEnv}={}){
  return new Promise<{code:number;stdout:string}>(resolve=>{
    const child=spawn(file,argv,{cwd:root,env:options.environment??env,stdio:['ignore',options.inherit?'inherit':'pipe',options.inherit?'inherit':'ignore']});
    let stdout='';child.stdout?.on('data',chunk=>{stdout=(stdout+String(chunk)).slice(-30000);});
    child.once('error',()=>resolve({code:1,stdout:''}));child.once('close',code=>resolve({code:code??1,stdout}));
  });
}
async function database(){const {connectToDatabase}=await import('../../src/lib/mongodb');await connectToDatabase();}
async function effectivePlan(plan:DailyAgentSchedule){
  const {TgEditionModel}=await import('../../src/models/tg/TgEdition');
  await database();
  const saved=await TgEditionModel.findOne({edition:plan.product.edition}).lean();
  if(!saved)throw new DailyAgentStop('Configurazione Daily esistente non trovata: non creare un database sostitutivo');
  return {...plan,product:parseProduct(saved.product)};
}
async function commissionedPlan(plan:DailyAgentSchedule,id:string){
  if(!/^[a-f0-9]{24}$/u.test(id))throw new DailyAgentStop('Commissione non valida');
  const {TgRunModel}=await import('../../src/models/tg/TgRun');
  await database();const saved=await TgRunModel.findById(id).select('+commissioning').lean().orFail();
  if(saved.commissioning?.kind!=='first-mac-cycle'||saved.edition!==plan.product.edition||saved.date!==localEditionDate(now,plan.product.timezone))throw new DailyAgentStop('Commissione odierna esplicita non trovata');
  return {...plan,product:parseProduct(saved.product)};
}
function runtimeReadiness(){return {
  researchAIConfigured:Boolean(process.env.OPENAI_API_KEY),databaseConfigured:Boolean(process.env.MONGODB_URI),
  approvedVoiceConnected:alex2SynthesisVerified(),
  voiceConfiguration:alex2ConfigStatus(),
  voiceReason:'Percorso Alex 2 implementato; prova reale API e master completo da verificare con daily:voice. Nessun cambio di voce automatico.',
  workTaskVerified:false,
  workReason:'Task ChatGPT Work da creare nella UI desktop con il prompt docs/tg/cdaily-work-publication-task.md. Il tool non crea né verifica task Work nella UI.',
};}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/u.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
async function main(){
  const configured=parseAgentSchedule(JSON.parse(await readFile(path.join(root,'config/tg/daily-agent.json'),'utf8')));
  if(command==='plan')return output({source:'config/tg/daily-agent.json (preview)',plan:configured,calendar:agentCalendar(configured,now),runtime:runtimeReadiness()});
  if(command==='configure'){
    if(dryRun)return output({action:'configure',plan:configured});
    await database();const {TgEditionModel}=await import('../../src/models/tg/TgEdition');
    const current=await TgEditionModel.findOne({edition:configured.product.edition}).lean().orFail();
    const fields=['productionTime','publishTime','productionMode','productionStandard','publicationDriver','siteFirst','enabled','automatic','textReviewMode'] as const;
    const product=parseProduct({...current.product,...Object.fromEntries(fields.map(k=>[k,configured.product[k]]))});
    const result=await TgEditionModel.updateOne({_id:current._id,revision:current.revision},{$set:{product,updatedAt:now},$inc:{revision:1}});
    if(result.modifiedCount!==1)throw new DailyAgentStop('Configurazione cambiata durante il salvataggio');
    return output({configured:true,edition:configured.product.edition,productionTime:configured.product.productionTime,publishTime:configured.product.publishTime,timezone:configured.product.timezone,publicationDriver:configured.publicationDriver,productionMode:product.productionMode??'full',textReviewMode:product.textReviewMode??'ai'});
  }
  if(command==='install'||command==='uninstall'||command==='persist'){
    if(command!=='uninstall'&&configured.productionDriver==='launchd'&&configured.product.productionMode==='full')throw new DailyAgentStop('Per il produttore completo usare npm run daily:mac -- install');
    if(process.platform!=='darwin'||process.getuid===undefined)throw new DailyAgentStop('Questo installer è per macOS launchd; usare il contratto Work o un timer sul render host negli altri ambienti');
    const label='me.conclavia.daily-production',service=`gui/${process.getuid()}/${label}`,plist=path.join(stateDir,label+'.plist');
    const loginPath=path.join(os.homedir(),'Library','LaunchAgents',label+'.plist');
    if(dryRun)return output({action:command,service,plist,loginPath,productionTime:configured.product.productionTime,timezone:configured.product.timezone});
    if(command==='persist'){
      const loaded=await spawnCommand('/bin/launchctl',['print',service]);
      if(loaded.code!==0)throw new DailyAgentStop('Caricare e verificare install prima di abilitarlo al login');
      await mkdir(path.dirname(loginPath),{recursive:true,mode:0o700});
      try{await symlink(plist,loginPath);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
      if(await readlink(loginPath)!==plist)throw new DailyAgentStop('Registrazione login esistente diversa: non verrà sostituita');
      await writeState('installation.json',{installed:true,at:now.toISOString(),service,plist,loginPath,persistentAcrossLogin:true,workTaskVerified:false});
      return output({installed:true,persistentAcrossLogin:true,service,loginPath});
    }
    if(command==='uninstall'){
      const result=await spawnCommand('/bin/launchctl',['bootout',service]);
      if(result.code!==0)throw new DailyAgentStop('Timer non scaricato: verificare launchctl prima di dichiararlo disattivato');
      try{if(await readlink(loginPath)===plist)await unlink(loginPath);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      await writeState('installation.json',{installed:false,at:now.toISOString(),service});return output({installed:false,service});
    }
    const x=(s:string)=>s.replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/"/gu,'&quot;');
    await mkdir(stateDir,{recursive:true,mode:0o700});
    const argv=[process.execPath,'--conditions=react-server','--import','tsx','--env-file-if-exists=.env.local',path.join(root,'scripts/tg/daily-agent.ts'),'tick'];
    // Calendar checks every minute, including waking from sleep. The actual
    // Europe/Rome window is decided in code, independently of the Mac's zone.
    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${argv.map(v=>`<string>${x(v)}</string>`).join('')}</array><key>WorkingDirectory</key><string>${x(root)}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>${x(process.env.PATH??'/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin')}</string></dict><key>RunAtLoad</key><true/><key>StartCalendarInterval</key><dict/><key>StandardOutPath</key><string>${x(path.join(stateDir,'scheduler.log'))}</string><key>StandardErrorPath</key><string>${x(path.join(stateDir,'scheduler-error.log'))}</string></dict></plist>\n`;
    const existing=await spawnCommand('/bin/launchctl',['print',service]);
    if(existing.code===0)return output({installed:true,alreadyLoaded:true,service,installation:await localState('installation.json')});
    await writeFile(plist,xml,{mode:0o600});
    const loaded=await spawnCommand('/bin/launchctl',['bootstrap',`gui/${process.getuid()}`,plist]);
    const checked=await spawnCommand('/bin/launchctl',['print',service]);
    if(loaded.code!==0||checked.code!==0)throw new DailyAgentStop('launchd non ha confermato il timer; nessuna schedulazione dichiarata attiva');
    const receipt={installed:true,at:now.toISOString(),service,plist,persistentAcrossLogin:false,workTaskVerified:false};
    await writeState('installation.json',receipt);return output(receipt);
  }
  if(command==='status'){
    let plan=configured,databaseStatus='unavailable';
    try{plan=await effectivePlan(configured);databaseStatus='connected';}catch{}
    const service=process.platform==='darwin'&&process.getuid?`gui/${process.getuid()}/me.conclavia.daily-production`:undefined;
    const loaded=service?(await spawnCommand('/bin/launchctl',['print',service])).code===0:false;
    const controller=databaseStatus==='connected'?(await (await import('../../src/lib/tg/runtime-readiness')).productionRuntime()).controller:undefined;
    const {TgRunModel}=await import('../../src/models/tg/TgRun');
    const current=databaseStatus==='connected'?await TgRunModel.findOne({edition:plan.product.edition,date:localEditionDate(now,plan.product.timezone)}).select('date state issues product.productionMode product.textReviewMode').lean():undefined;
    return output({at:now.toISOString(),database:databaseStatus,plan,calendar:agentCalendar(plan,now),decision:agentDecision(plan,now),
      currentEdition:current?{date:current.date,state:current.state,issues:current.issues,mode:current.product.productionMode,textReviewMode:current.product.textReviewMode}:undefined,
      timer:{scope:'local',loaded,installation:await localState('installation.json'),lastTick:await localState('last-tick.json'),lastProduction:await localState('last-production.json'),lastError:await localState('last-error.json')},runtime:{...runtimeReadiness(),productionController:controller}});
  }
  if(!['tick','run','publish','package','channels','preflight'].includes(command))throw new DailyAgentStop('Comandi: plan, status, configure, install, persist, uninstall, tick, run, package, channels, preflight, publish. Aggiungere --dry-run per anteprima senza effetti.');
  let plan=configured;
  if(!dryRun)plan=await effectivePlan(configured);
  const commissioned=args.find(a=>a.startsWith('--commission='))?.slice(13);
  if(commissioned&&!dryRun){if(!['preflight','tick','run'].includes(command))throw new DailyAgentStop('Comando non previsto per la commissione');plan=await commissionedPlan(plan,commissioned);}
  const decision=agentDecision(plan,now),requested=args.find(a=>a.startsWith('--date='))?.slice(7)??'today';
  const date=requested==='today'?localEditionDate(now,plan.product.timezone):requested;
  if(!validDate(date)||date!==decision.date)throw new DailyAgentStop('Il runner opera solo sull’edizione di oggi nel fuso configurato; nessuna notizia riciclata o produzione retrodatata');
  if(dryRun)return output({action:command,date,decision,mutation:false,runtime:runtimeReadiness()});
  if(command==='preflight'){
    const {productionRuntime,readinessWithRuntime}=await import('../../src/lib/tg/runtime-readiness');
    const {publicationControl}=await import('../../src/lib/tg/newsroom');
    const runtime=await productionRuntime();
    const {TgRunModel}=await import('../../src/models/tg/TgRun');
    const {serializeJob}=await import('../../src/lib/tg/store');
    const record=await TgRunModel.findOne({edition:plan.product.edition,date}).lean();
    const job=record?serializeJob(record):undefined;
    return output({at:now.toISOString(),edition:plan.product.edition,mode:job?.product.productionMode??plan.product.productionMode??'full',decision,
      stage:macProductionStage(plan.product,job,now),currentEdition:job?{date:job.date,state:job.state,textReviewMode:job.product.textReviewMode,issues:job.issues}:undefined,
      runtime,readiness:readinessWithRuntime(plan.product,runtime),distribution:await publicationControl(),mutations:false,providerGeneration:false});
  }
  if(command==='channels'){
    const {checkChannels}=await import('../../src/lib/tg/channel-checks');
    return output({edition:plan.product.edition,checks:await checkChannels(plan.product),generation:false,publication:false});
  }
  await writeState('last-tick.json',{at:now.toISOString(),command,date,reason:decision.reason});
  if(command==='tick'||command==='run'){
    const {TgControllerModel}=await import('../../src/models/tg/TgController');
    await TgControllerModel.updateOne({key:'daily-production'},{$set:{heartbeatAt:now,mode:plan.product.productionMode??'full',driver:'launchd'}},{upsert:true});
    if(!decision.due)return output({action:'skipped',date,reason:decision.reason});
    if(!plan.product.automatic||plan.product.publicationDriver!=='chatgpt-work'||plan.product.productionStandard!=='cdaily-v1')throw new DailyAgentStop('Configurazione non autonoma CDaily/Work: applicare il piano deliberato prima di avviare la produzione');
    if(!process.env.OPENAI_API_KEY)throw new DailyAgentStop('Ricerca AI non configurata; nessuna sintesi o pubblicazione avviata');
    const {queueEdition}=await import('../../src/lib/tg/store');
    const run=await queueEdition(plan.product,now,date);
    const {TgRunModel}=await import('../../src/models/tg/TgRun');
    const {serializeJob}=await import('../../src/lib/tg/store');
    const id=run._id.toString();
    // Frozen edition settings are never overwritten by a later GUI change.
    if(run.product.productionStandard!=='cdaily-v1'||run.product.publicationDriver!=='chatgpt-work')throw new DailyAgentStop('Edizione esistente con un altro contratto: non sovrascrivere o pubblicare automaticamente');
    if(!['queued','researching','writing','verifying','voicing','rendering','reviewing'].includes(run.state))return output({action:'existing',job:id,date,state:run.state,issues:run.issues});
    const controllerBeat=setInterval(()=>void TgControllerModel.updateOne({key:'daily-production'},{$set:{heartbeatAt:new Date(),driver:'launchd',mode:plan.product.productionMode??'full'}}).catch(()=>undefined),30000);
    let result:{code:number;stdout:string};
    try{result=await spawnCommand(process.execPath,['--conditions=react-server','--import','tsx','scripts/tg/worker.ts','--once',`--job=${id}`,'--no-schedule','--no-publish','--approved-daily'],{inherit:true,environment:{...env,...(plan.editorialModel?{PODCAST_OPENAI_MODEL:plan.editorialModel}:{}),TG_WORKER_ENABLED:'true',TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true',TG_AUTOMATIC_REVIEW_ENABLED:'true'}});}
    finally{clearInterval(controllerBeat);}
    const latest=await TgRunModel.findById(id).lean().orFail();
    const job=serializeJob(latest);
    const report={at:new Date().toISOString(),date,job:id,state:job.state,issues:job.issues,attempts:job.attempts,workerExitCode:result.code};
    await TgControllerModel.updateOne({key:'daily-production'},{$set:{lastDate:date,lastState:job.state,lastFinishedAt:new Date()}});
    await writeState('last-production.json',report);return output(report);
  }
  const {TgRunModel}=await import('../../src/models/tg/TgRun');
  const {serializeJob}=await import('../../src/lib/tg/store');
  const record=await TgRunModel.findOne({edition:plan.product.edition,date}).lean();
  if(!record)throw new DailyAgentStop('Edizione non ancora creata: non pubblicare altri video al suo posto');
  const job=serializeJob(record);
  if(job.product.publicationDriver!=='chatgpt-work')throw new DailyAgentStop('Questa edizione non appartiene al publisher Work');
  const {auditIsCurrent,approvalIsBound}=await import('../../src/lib/tg/review');
  if(command==='package'){
    if(!auditIsCurrent(job,now))throw new DailyAgentStop('Testo non verificato o controllo scaduto: pacchetto social non esportabile');
    const {loadPublishedHistory}=await import('../../src/lib/tg/history');
    const {freshnessIsCurrent}=await import('../../src/lib/tg/freshness');
    if(!freshnessIsCurrent(job,now,await loadPublishedHistory(job.edition,job.date,now)))throw new DailyAgentStop('Archivio delle uscite cambiato: ricontrollare il testo prima di esportarlo');
    const {saveEditionTexts}=await import('../../src/lib/tg/edition-text-files');
    return output({job:job.id,date,state:job.state,approvedForPublication:approvalIsBound(job),...await saveEditionTexts(job)});
  }
  if(job.state==='published')return output({job:job.id,date:job.date,state:'published',alreadyPublished:true,deliveries:job.deliveries});
  if(process.env.TG_PUBLISH_ENABLED!=='true')throw new DailyAgentStop('Invii reali disabilitati nel runtime: nessuna pubblicazione eseguita');
  if(!decision.due||now.getTime()<Date.parse(decision.slot.scheduledAt))throw new DailyAgentStop('Fuori finestra di pubblicazione Work');
  if(!['ready','publishing','published'].includes(job.state)||!auditIsCurrent(job,now)||!approvalIsBound(job))throw new DailyAgentStop('Edizione senza approvazione AI attuale e pacchetto vincolato: nessun invio');
  const {publishReadyTg}=await import('../../src/lib/tg/publishing');
  await publishReadyTg(AbortSignal.timeout(10*60000),undefined,{driver:'chatgpt-work',edition:job.edition,date:job.date,jobId:job.id});
  const updated=serializeJob(await TgRunModel.findById(job.id).lean().orFail());
  return output({job:updated.id,date:updated.date,state:updated.state,deliveries:updated.deliveries,issues:updated.issues});
}
main().catch(async(error:unknown)=>{
  // Do not echo arbitrary provider/DB errors, URLs, credentials or child env.
  const report={at:new Date().toISOString(),command,state:'blocked',issue:error instanceof DailyAgentStop?error.message:'Comando Daily non completato. Controllare status, configurazione e redazione; nessuna riuscita presunta.'};
  await writeState('last-error.json',report).catch(()=>undefined);output(report);process.exitCode=1;
}).finally(async()=>{const {default:mongoose}=await import('mongoose');await mongoose.disconnect();});
