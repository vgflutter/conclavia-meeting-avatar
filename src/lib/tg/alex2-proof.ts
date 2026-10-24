import 'server-only';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { alex2Config, alex2ConfigDigest } from './alex2-config';

export const ALEX2_PROBE_TEXT='Ciao, questo è Conclavia Daily. Le notizie contano quando le capiamo. Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande.';
export const alex2ProofDirectory=()=>path.resolve('.daily-agent','alex2-voice-proof');
/** A configured key is not proof of synthesis. This checks the private receipt
 * and actual bounded audio, without exposing IDs, account data or credentials. */
export function alex2SynthesisVerified(env:Record<string,string|undefined>=process.env,now=Date.now()) {
  try {
    const config=alex2Config(env),directory=alex2ProofDirectory(),file=path.join(directory,'proof.json'),audio=path.join(directory,'take.wav');
    if(statSync(file).size>100000||statSync(audio).size>24000*2*60+44)return false;
    const proof=JSON.parse(readFileSync(file,'utf8')),time=Date.parse(proof.checkedAt),bytes=readFileSync(audio),tokens=ALEX2_PROBE_TEXT.split(/\s+/u);
    const seconds=(bytes.length-44)/48000;
    let power=0,peak=0,clipped=0;
    for(let i=44;i+1<bytes.length;i+=2){const sample=Math.abs(bytes.readInt16LE(i)/32768);power+=sample*sample;peak=Math.max(peak,sample);if(sample>.995)clipped++;}
    const count=(bytes.length-44)/2;
    return proof.version===1&&proof.configSha256===alex2ConfigDigest(config)&&proof.text===ALEX2_PROBE_TEXT
      &&bytes.length>2444&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.readUInt32LE(24)===24000
      &&Number.isInteger(count)&&Math.sqrt(power/count)>.004&&peak>.02&&clipped/count<.001
      &&Math.abs(proof.seconds-seconds)<1/24000&&proof.audioSha256===createHash('sha256').update(bytes).digest('hex')
      &&Array.isArray(proof.words)&&proof.words.length===tokens.length
      &&proof.words.every((w:{text:string;start:number;end:number},i:number)=>w.text===tokens[i]&&Number.isFinite(w.start)&&Number.isFinite(w.end)
        &&w.start>=0&&w.end>w.start&&w.end<=seconds+.02&&(!i||w.start>=proof.words[i-1].end-.03))
      &&Number.isFinite(time)&&time<=now&&now-time<7*86400000;
  } catch { return false; }
}
