/** Portable Mac producer. The server stores publications; Work distributes them.
 * No credentials are embedded in plists, command arguments or state receipts. */
import {readFile,writeFile,mkdir,rename,readlink,symlink,unlink,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {macRenderServer} from './mac-render-server.mjs';
import {runMacCommand} from './mac-process.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),state=join(root,'.daily-agent'),deploy=resolve(root,'../conclavia-deploy');
const labels=['me.conclavia.daily-mongo','me.conclavia.daily-awake','me.conclavia.daily-production'];
const action=process.argv[2]??'status',runtime={...process.env,TG_ARTIFACT_DIR:join(root,'.tg-artifacts'),TG_RESEARCH_TRACE_DIR:join(state,'research-trace'),TG_PUBLISH_ENABLED:'false',TG_EDITORIAL_ONLY:'false',TG_WORKER_ENABLED:'true',TG_AI_ENABLED:'true',PODCAST_AI_ENABLED:'true',PODCAST_SPEECH_ENABLED:'true',TG_AUTOMATIC_REVIEW_ENABLED:'true'};
let phase='initializing';
const nodeArgs=['--conditions=react-server','--import','tsx','--env-file-if-exists=.env.local'];
const shutdown=new AbortController();
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>shutdown.abort());
const privateState=async(name,value)=>{await mkdir(state,{recursive:true,mode:0o700});const f=join(state,name);await writeFile(f+'.partial',JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(f+'.partial',f);};
const run=(file,args,options={})=>runMacCommand(file,args,{cwd:root,env:runtime,signal:shutdown.signal,...options});
const daily=(command,...args)=>run(process.execPath,[...nodeArgs,'scripts/tg/daily-agent.ts',command,...args]);
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
function loaded(label){try{execFileSync('/bin/launchctl',['print',`gui/${process.getuid()}/${label}`],{stdio:'ignore'});return true;}catch{return false;}}
async function checks(){
 const binaries={};for(const name of ['ffmpeg','ffprobe','ssh'])try{execFileSync('/usr/bin/which',[name],{stdio:'ignore',env:runtime});binaries[name]=true;}catch{binaries[name]=false;}
 const {chromium}=await import('@playwright/test');
 const chrome=await exists('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
 return {mac:process.platform==='darwin',node:Number(process.versions.node.split('.')[0])>=22,...binaries,
  browser:chrome||await exists(chromium.executablePath()),chrome,privateEnvironment:await exists(join(root,'.env.local')),
  ai:Boolean(runtime.OPENAI_API_KEY),voice:Boolean(runtime.ELEVENLABS_API_KEY&&runtime.TG_IT_ELEVENLABS_VOICE_ID),deployment:await exists(join(deploy,'conclavia.config.json'))};
}
async function status(){
 const prerequisites=await checks();let plan;
 try{plan=JSON.parse(await daily('status'));}catch{plan={database:'unavailable'};}
 let latest;try{latest=JSON.parse(await readFile(join(state,'mac-last-run.json'),'utf8'));}catch{}
 return {host:'this-mac',prerequisites,services:Object.fromEntries(labels.map(l=>[l,loaded(l)])),database:plan.database,
  schedule:plan.plan?.product,decision:plan.decision,nextStartAt:plan.calendar?.find(s=>Date.parse(s.prepareAt)>Date.now())?.prepareAt,approvedVoiceVerified:plan.runtime?.approvedVoiceConnected,currentEdition:plan.currentEdition,lastRun:latest,socialPublishing:false};
}
async function lock(){
 const file=join(state,'mac-producer.lock');await mkdir(state,{recursive:true,mode:0o700});
 for(let attempt=0;attempt<2;attempt++)try{await writeFile(file,String(process.pid),{flag:'wx',mode:0o600});return()=>unlink(file).catch(()=>{});}
 catch(error){
  if(error.code!=='EEXIST')throw error;
  const pid=Number(await readFile(file,'utf8'));if(!Number.isInteger(pid)||pid<2)throw Error('Lock produttore da controllare');
  try{process.kill(pid,0);const command=execFileSync('/bin/ps',['-p',String(pid),'-o','command='],{encoding:'utf8'});if(command.includes('scripts/tg/mac-agent.mjs'))return undefined;await unlink(file);}catch(e){if(e.code!=='ESRCH')return undefined;await unlink(file);}
 }
 return undefined;
}
async function tick(commission=false){
 const release=await lock();if(!release)return {state:'already-running'};
 let renderer;
 try{
  let extra=[];
  if(commission){phase='commission';const receipt=JSON.parse(await run(process.execPath,[...nodeArgs,'scripts/tg/commission-today.ts','--confirm']));extra=[`--commission=${receipt.jobId}`];}
  phase='preflight';const decision=JSON.parse(await daily('preflight',...extra));
  if(!decision.decision?.due)return {state:'skipped',reason:decision.decision?.reason};
  const prereq=await checks();if(Object.entries(prereq).some(([k,v])=>k!=='chrome'&&!v))throw Error('Prerequisiti Mac incompleti: eseguire daily:mac doctor');
  phase='identity';await run(process.execPath,['scripts/tg/check-video-identity.mjs']);
  phase='render-host';renderer=await macRenderServer();
  const env={...runtime,TG_RENDER_ORIGIN:renderer.origin,TG_RENDER_PATH:'/__cdaily-render__/',...(prereq.chrome?{TG_CHROME_CHANNEL:'chrome'}:{})};
  phase='production';await run(process.execPath,[...nodeArgs,'scripts/tg/daily-agent.ts','tick',...extra],{env,inherit:true,timeout:Math.max(1000,Date.parse(decision.decision.slot.closesAt)-Date.now())});
  let produced;
  try{produced=JSON.parse(await readFile(join(state,'last-production.json'),'utf8'));}catch{}
  // Query the current job explicitly: an older local receipt never selects an upload.
  phase='package';const pack=JSON.parse(await run(process.execPath,[...nodeArgs,'scripts/tg/prepare-site-upload.ts','--today'],{env}));
  if(!pack.ready)return {state:pack.state,date:pack.date,issues:pack.issues??[],videoUploaded:false};
  if(pack.alreadyPublished)return {state:'website-published',date:pack.date,url:pack.url};
  phase='website-upload';const upload=await run(process.execPath,['bin/conclavia.mjs','daily-site','upload',`--job=${pack.jobId}`],{cwd:deploy,env,timeout:Math.max(1000,Date.parse(decision.decision.slot.closesAt)-Date.now())});
  return {state:'website-published',date:pack.date,job:pack.jobId,result:JSON.parse(upload),workerState:produced?.state};
 }finally{await renderer?.close();await release();}
}
async function install(){
 if(process.platform!=='darwin'||!process.getuid)throw Error('Installer macOS richiesto');
 const prereq=await checks();if(Object.entries(prereq).some(([k,v])=>k!=='chrome'&&!v))return {installed:false,prerequisites:prereq};
 await run(process.execPath,['bin/conclavia.mjs','daily-editorial','pause'],{cwd:deploy});
 const launch=join(homedir(),'Library/LaunchAgents');await mkdir(launch,{recursive:true});await mkdir(state,{recursive:true,mode:0o700});
 const escape=s=>String(s).replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const programs=[['/usr/bin/ssh','-N','-T','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','mongo-tunnel'],['/usr/bin/caffeinate','-s'],[process.execPath,...nodeArgs,'scripts/tg/mac-agent.mjs','tick']];
 for(const [index,label] of labels.entries()){
  const file=join(state,label+'.plist'),link=join(launch,label+'.plist');
  try{const previous=await readlink(link);if(previous!==file){const contents=await readFile(previous,'utf8');if(!contents.includes('Managed by Conclavia Daily Mac')||!contents.includes(`<string>${label}</string>`))throw Error('LaunchAgent preesistente non riconosciuto');if(loaded(label))await run('/bin/launchctl',['bootout',`gui/${process.getuid()}/${label}`]);await unlink(link);}}catch(e){if(e.code!=='ENOENT')throw e;}
  if(loaded(label))await run('/bin/launchctl',['bootout',`gui/${process.getuid()}/${label}`]);
  if(index===2){
   const connected=JSON.parse(await daily('status'));if(connected.database!=='connected')throw Error('Prerequisiti Mongo incompleti: verificare il tunnel configurato');
   await daily('configure');
  }
  const keep=index<2?'<key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer>':'<key>StartInterval</key><integer>60</integer>';
  const body=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Comment</key><string>Managed by Conclavia Daily Mac</string><key>Label</key><string>${label}</string><key>WorkingDirectory</key><string>${escape(root)}</string><key>ProgramArguments</key><array>${programs[index].map(v=>`<string>${escape(v)}</string>`).join('')}</array><key>EnvironmentVariables</key><dict><key>PATH</key><string>${escape(process.env.PATH??'/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin')}</string></dict><key>RunAtLoad</key><true/>${keep}<key>StandardOutPath</key><string>${escape(join(state,label+'.log'))}</string><key>StandardErrorPath</key><string>${escape(join(state,label+'.error.log'))}</string></dict></plist>`;
  await writeFile(file,body,{mode:0o600});for(const suffix of ['.log','.error.log']){const log=join(state,label+suffix);if(!await exists(log))await writeFile(log,'',{mode:0o600});}
  try{await symlink(file,link);}catch(e){if(e.code!=='EEXIST')throw e;}
  await run('/bin/launchctl',['bootstrap',`gui/${process.getuid()}`,file]);if(!loaded(label))throw Error('LaunchAgent non verificato');
 }
 const receipt={installed:true,at:new Date().toISOString(),root,node:process.execPath,productionTime:'07:30',publishTime:'08:15',timezone:'Europe/Rome',serverProducerPaused:true,services:labels};
 await privateState('mac-installation.json',receipt);return receipt;
}
async function uninstall(){
 for(const label of [...labels].reverse()){
  const file=join(state,label+'.plist'),link=join(homedir(),'Library/LaunchAgents',label+'.plist');
  try{if(await readlink(link)!==file)throw Error('LaunchAgent estraneo preservato');}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(loaded(label))await run('/bin/launchctl',['bootout',`gui/${process.getuid()}/${label}`]);await unlink(link);
 }
 await privateState('mac-installation.json',{installed:false,at:new Date().toISOString()});return {installed:false};
}
try{
 let result;
 if(action==='install')result=await install();
 else if(action==='uninstall')result=await uninstall();
 else if(action==='status'||action==='doctor')result=await status();
 else if(['tick','run','commission'].includes(action)){result=await tick(action==='commission');await privateState('mac-last-tick.json',{at:new Date().toISOString(),...result});if(!['skipped','already-running'].includes(result.state))await privateState('mac-last-run.json',{at:new Date().toISOString(),...result});}
 else throw Error('Comandi: install, uninstall, doctor, status, tick, run, commission');
 console.log(JSON.stringify(result,null,2));
}catch(error){await privateState('mac-last-error.json',{at:new Date().toISOString(),phase,state:'blocked',issue:'Produttore Mac non completato: verificare doctor e lo stato privato'});console.error(error instanceof Error&&/^Prerequisiti|^LaunchAgent|^Installer|^Lock|^Comandi/u.test(error.message)?error.message:'Produttore Mac fermato; consultare lo stato privato, nessuna riuscita presunta');process.exitCode=1;}
