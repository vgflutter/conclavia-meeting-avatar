import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderMedia, wave } from '../../src/lib/tg/media';
import { jobDirectory } from '../../src/lib/tg/artifacts';
import { TG_PRODUCTS } from '../../src/lib/tg/config';
import type { TgManifest } from '../../src/lib/tg/types';
async function main() {
  if (process.env.TG_TEST_MODE !== 'true' || process.env.MONGODB_URI !== 'mongodb://127.0.0.1:27018' || !process.env.MONGODB_DB_NAME?.startsWith('conclavia_e2e_') || process.env.TG_AI_ENABLED === 'true' || process.env.TG_PUBLISH_ENABLED === 'true') throw new Error('Verifica media isolata richiesta');
  const id='e'.repeat(24), seconds=4, dir=jobDirectory(id);await mkdir(dir,{recursive:true});
  const manifest:TgManifest={version:1,product:{...TG_PRODUCTS[0],presenters:2},date:'2026-10-18',seconds,demo:true,
    stories:[{id:'demo',headline:'Capire il presente. Una notizia alla volta.',category:'society',importance:80,whyItMatters:'Che cosa è successo. Perché conta. Che cosa cambia per te.',changedSinceYesterday:'Gli aggiornamenti, senza ripartire da zero.',uncertainty:'',facts:[],sourceIds:[]}],sources:[],cues:[{storyId:'demo',speaker:0,text:'Questa è una prova tecnica con audio sintetico, non una notizia reale.',mood:'attention',intensity:.4,sourceIds:[],start:0,end:1.9,frameSeconds:.1,levels:Array(19).fill(.45),phones:[{start:0,end:1.9,viseme:'a'}]},{storyId:'demo',speaker:1,text:'Verifichiamo le due voci e il formato verticale.',mood:'curiosity',intensity:.5,sourceIds:[],start:2,end:3.8,frameSeconds:.1,levels:Array(18).fill(.4),phones:[{start:0,end:1.8,viseme:'a'}]}]};
  const pcm=Buffer.alloc(seconds*24000*2);for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round(1000*Math.sin(i*Math.PI/32)),i*2);await writeFile(path.join(dir,'track.wav'),wave(pcm));
  const assets=await renderMedia(id,manifest,AbortSignal.timeout(120000));console.log(JSON.stringify({id,assets}));
}
void main().catch(()=>{console.error('Verifica media TG non riuscita');process.exitCode=1;});
