import type {SpeechWord} from '@conclavia/avatar-kit/speech';
export const DAILY_OPENING_PAUSE_SECONDS=2;

/** Product edit for Daily's measured intro handoff; 16-bit mono PCM only. */
export function insertDailyOpeningPause(pcm:Buffer,words:SpeechWord[],rate:number,before:number,after:number,seconds=DAILY_OPENING_PAUSE_SECONDS){
 if(!Number.isInteger(rate)||rate<8000||pcm.length%2||!Number.isFinite(before)||!Number.isFinite(after)||before<0||after<before||after>pcm.length/(rate*2)||seconds<1||seconds>2)throw Error('Invalid Daily opening pause');
 const existing=after-before;
 if(existing>seconds+.05)throw Error('Existing opening pause needs explicit shortening review');
 const added=Math.max(0,seconds-existing);
 if(added<1/rate)return {pcm,words,edit:{atSeconds:before,addedSeconds:0,wordGapSeconds:existing,quietRms:0,fadeSeconds:0}};
 const fade=Math.round(rate*.006),window=Math.round(rate*.02),lo=Math.ceil(before*rate)+fade,hi=Math.floor(after*rate)-fade;
 if(hi-lo<window)throw Error('No measured word-free opening corridor; review the recording before editing');
 let best=Infinity,cut=-1;
 for(let at=lo;at+window<=hi;at+=Math.max(1,Math.round(rate*.002))){let power=0;for(let i=at;i<at+window;i++){const sample=pcm.readInt16LE(i*2)/32768;power+=sample*sample;}const rms=Math.sqrt(power/window);if(rms<best){best=rms;cut=at+Math.floor(window/2);}}
 if(cut<0||best>.02||words.some(w=>w.start<cut/rate&&w.end>cut/rate))throw Error('Opening boundary is not safely quiet between measured words');
 const count=Math.round(added*rate),result=Buffer.concat([pcm.subarray(0,cut*2),Buffer.alloc(count*2),pcm.subarray(cut*2)]);
 for(let i=0;i<fade;i++){const gain=(1-Math.cos(Math.PI*i/(fade-1)))/2;const left=cut-fade+i,right=cut+count+i;result.writeInt16LE(Math.round(result.readInt16LE(left*2)*(1-gain)),left*2);result.writeInt16LE(Math.round(result.readInt16LE(right*2)*gain),right*2);}
 const shift=count/rate,atSeconds=cut/rate;
 return {pcm:result,words:words.map(w=>w.start>=atSeconds?{...w,start:w.start+shift,end:w.end+shift}:{...w}),edit:{atSeconds,addedSeconds:shift,wordGapSeconds:existing+shift,quietRms:best,fadeSeconds:fade/rate,sourceWordGapSeconds:existing}};
}
