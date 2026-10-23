/** User-selected visual proof: cached dated speech, no providers or publishing. */
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {planPerformancePhrases,type GestureIntent} from '@conclavia/avatar-kit/performance';
import type {TgPromoSequence} from '@conclavia/avatar-kit/formats/tg';
import {dailyPerformanceForPosture} from '../../src/lib/tg/performance-direction';
import {dailyApprovedAvatar,dailyApprovedStyleRevision} from '../../src/components/tg/daily-avatar-preset';

async function main(){
 const arg=(key:string)=>process.argv.find(v=>v.startsWith('--'+key+'='))?.slice(key.length+3);
 const source=arg('source'),target=arg('target'),closingReference=arg('closing-reference');
 if(!process.argv.includes('--confirm')||process.env.TG_PUBLISH_ENABLED!=='false'||!source||!target||source===target||![source,target].every(v=>/^\d{4}-\d{2}-\d{2}-it-pilot(?:-r[1-9]\d*)?$/u.test(v))||source.slice(0,10)!==target.slice(0,10))throw Error('Explicit same-date archived visual proof required');
 const root=path.resolve('public/daily-launch/editions'),from=path.join(root,source),out=path.join(root,target);
 if(await access(out).then(()=>true,()=>false))throw Error('Preserve existing editions; target already exists');
 type Cue=TgPromoSequence['cues'][number]&{intent?:GestureIntent};
 const original=JSON.parse(await readFile(from+'/manifest.json','utf8'));
 if(original.editionDate!=='2026-10-21'||original.editionDate!==target.slice(0,10)||original.kind!=='daily-pilot'||!original.previewOnly||original.duration>300)throw Error('This archive proof requires the dated 21 October private pilot');
 const m=structuredClone(original) as typeof original&{cues:Cue[]};
 const groups:{indices:number[]}[]=[];
 // Preserve real sentences/moods; join short grammatical clauses only within
 // one news item, so changing expression does not restart the whole arm.
 m.cues.forEach((cue:Cue,i:number)=>{
  const group=groups.at(-1),prior=group?m.cues[group.indices.at(-1)!]:undefined;
  if(group&&prior&&prior.scene===cue.scene&&prior.end>=cue.start-.35&&!/[.!?…][”"'»)]*$/u.test(prior.text)&&cue.end-m.cues[group.indices[0]].start<22)group.indices.push(i);
  else groups.push({indices:[i]});
 });
 const plans=planPerformancePhrases(groups.map(({indices},i)=>{
  const first=m.cues[indices[0]],last=m.cues[indices.at(-1)!],closing=indices.some(n=>m.cues[n].intent==='point-down');
  const word=closing?m.words.find((w:{text:string;start:number;end:number})=>w.start>=first.start&&w.end<=last.end&&w.text.toLocaleLowerCase('it-IT').replace(/[^\p{L}]/gu,'')==='commenti'):undefined;
  return {cueId:target+':'+i,mood:first.mood,intensity:first.intensity,startSeconds:first.start,durationSeconds:last.end-first.start,
   intent:closing?'point-down' as const:first.intent==='fold-hands'?'reflect' as const:first.intent,
   ...(word?{accents:[(word.start+word.end)/2-first.start]}:{})};
 }),{seed:target,actorId:'Alex',...dailyPerformanceForPosture('standing')});
 groups.forEach(({indices},group)=>{const first=m.cues[indices[0]],last=m.cues[indices.at(-1)!];for(const i of indices){m.cues[i].choreography=plans[group];if(indices.length>1)m.cues[i].performanceWindow={start:first.start,end:last.end};else delete m.cues[i].performanceWindow;}});
 // An approved gesture is a frozen direction, not a request to generate a
 // different variant when embedding it into a longer edition.
 if(closingReference){
  if(!/^avatar-[a-z0-9-]{1,70}$/u.test(closingReference))throw Error('Invalid closing reference');
  const reference=JSON.parse(await readFile(path.resolve('public/daily-launch/revisions',closingReference,'manifest.json'),'utf8'));
  if(reference.duration>15||!reference.cues.some((c:Cue)=>c.intent==='point-down'))throw Error('Closing reference must be a short explicit gesture proof');
  for(const cue of reference.cues as Cue[]){
   const matches=m.cues.filter((c:Cue)=>c.scene==='chiusura'&&c.text===cue.text);
   if(matches.length!==1||!cue.choreography)throw Error('Closing recording does not match the approved proof');
   const current=matches[0];
   if(Math.abs((current.end-current.start)-(cue.end-cue.start))>.002)throw Error('Approved closing speech clock differs');
   current.choreography=structuredClone(cue.choreography);
   if(cue.performanceWindow){const offset=current.start-cue.start;current.performanceWindow={start:cue.performanceWindow.start+offset,end:cue.performanceWindow.end+offset};}
   else delete current.performanceWindow;
  }
  const offset=m.cues.find((c:Cue)=>c.intent==='point-down')!.start-reference.cues.find((c:Cue)=>c.intent==='point-down')!.start;
  m.approvedClosingGesture={revision:closingReference,mediaVersion:reference.mediaVersion,offsetSeconds:offset,directionUnchanged:true};
  if(m.closingIntegration){const {videos,...provenance}=m.closingIntegration;void videos;m.closingIntegration={...provenance,id:target,pointerApexAt:offset+reference.cues.find((c:Cue)=>c.intent==='point-down')!.start+reference.cues.find((c:Cue)=>c.intent==='point-down')!.choreography.strokes[0].apex};}
 }
 // Clean on-screen topic titles. Speech, date, news and measured times remain
 // historical; this proof does not reapprove the old editorial selection.
 const titles:Record<string,string[]>={apertura:['Quattro notizie.','21 ottobre 2026.'],trasporti:['Trasporti: fondi e proteste.'],mondo:['Ucraina: il tavolo di Oslo.'],scienza:['L’acqua vista dallo spazio.'],meteo:['Liguria: bollettino del 20 ottobre.'],chiusura:['Cosa vuoi approfondire?']};
 m.scenes=m.scenes.map((scene:TgPromoSequence['scenes'][number])=>({...scene,...(scene.kind==='signature'?{}:{kind:'host',lines:titles[scene.id]??scene.lines,items:undefined})}));
 Object.assign(m,{id:target,title:'CDaily · 21 ottobre 2026 · Prova del nuovo stile',styleReference:dailyApprovedStyleRevision,avatarFinish:dailyApprovedAvatar.finish,avatarPosture:dailyApprovedAvatar.posture,avatarHands:dailyApprovedAvatar.handStyle,
  reviewScope:'graphics-only-archived-audio',sourceEdition:source,editorialApproval:false,previewOnly:true,
  description:"Nel Daily del 21 ottobre, il governo annuncia risorse per l’autotrasporto, mentre le proteste proseguono in alcune regioni: gli impegni non equivalgono a pagamenti già eseguiti. A Oslo, i colloqui sull’Ucraina coinvolgono rappresentanti ucraini, americani ed europei; il confronto continua, senza un accordo di pace annunciato. Una ricerca presentata dalla NASA ricostruisce le variazioni delle riserve d’acqua attraverso osservazioni satellitari: aiuta a leggere tendenze di lungo periodo, senza prevedere la prossima siccità. Infine, il bollettino ligure del 20 ottobre indicava scadenze diverse dell’allerta per zona: un riepilogo datato, da distinguere dagli avvisi ufficiali aggiornati."});
 delete m.mediaVersion;
 const pcmFile=await readFile(from+'/audio.wav'),audioSha=createHash('sha256').update(pcmFile).digest('hex');
 m.visualReview={sourceAudioSha256:audioSha,sourceDate:original.editionDate,originalDuration:original.duration,audioUnchanged:true,wordsUnchanged:JSON.stringify(m.words)===JSON.stringify(original.words),speechUnchanged:JSON.stringify(m.cues.map((c:Cue)=>[c.text,c.start,c.end,c.mood,c.intensity,c.levels,c.phones]))===JSON.stringify(original.cues.map((c:Cue)=>[c.text,c.start,c.end,c.mood,c.intensity,c.levels,c.phones])),providerCalls:0};
 if(!m.visualReview.wordsUnchanged||!m.visualReview.speechUnchanged)throw Error('Visual proof changed the recorded speech');
 await mkdir(out);await copyFile(from+'/audio.wav',out+'/audio.wav');await copyFile(from+'/captions.vtt',out+'/captions.vtt');await copyFile(from+'/script.txt',out+'/script.txt');
 await writeFile(out+'/manifest.json',JSON.stringify(m,null,2)+'\n');
 await writeFile(out+'/caption.txt',m.title+'\n\n'+m.description+'\n\nProva locale del nuovo stile; non è un’edizione del 23 ottobre e non è approvata per la pubblicazione.\n');
 console.log(JSON.stringify({target,date:m.editionDate,duration:m.duration,voice:m.voice,styleReference:m.styleReference,groups:groups.length,providerCalls:0,audioUnchanged:true,published:false}));
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'Archived visual proof failed');process.exitCode=1;});
