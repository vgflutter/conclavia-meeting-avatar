import {cp,lstat} from 'node:fs/promises';
import path from 'node:path';

/** Keep paid speech checkpoints across a graphics-only refresh, excluding old renders. */
export async function preserveSpeechIntermediates(source:string,destination:string){
 const copied:string[]=[];
 for(const name of ['raw.wav','.speech','.trial-checkpoint.json','.mood-score.json','.mood-score-first.json','.mood-score-ai-revised.json','.mood-manifest.json','.editorial-notes.json']){
  try{await lstat(path.join(source,name));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
  await cp(path.join(source,name),path.join(destination,name),{recursive:true,force:false,errorOnExist:true});
  copied.push(name);
 }
 return copied;
}
