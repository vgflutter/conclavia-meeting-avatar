/** Casting for this creative review only. Saved voices in other shows stay owned by their product. */
export const dailyLaunchVoices=[
 {id:'conversazione',label:'A · Cedar',voiceId:'cedar',direction:'Conversazione',description:'Una direzione colloquiale, come raccontare qualcosa a un amico.',speakingRate:1.02},
 {id:'calore',label:'B · Marin',voiceId:'marin',direction:'Calore',description:'Una direzione vicina e sorridente, senza enfasi da annuncio.',speakingRate:1.02},
 {id:'energia',label:'C · Coral',voiceId:'coral',direction:'Vivacità',description:'Una direzione più vivace, con un ritmo quotidiano.',speakingRate:1.02},
] as const;
export type DailyLaunchVoiceId=typeof dailyLaunchVoices[number]['id'];
export function launchVoice(id:string){const voice=dailyLaunchVoices.find(v=>v.id===id);if(!voice)throw Error('Unknown launch audition');return voice;}
export function launchVoiceBase(id:DailyLaunchVoiceId){return `/daily-launch/voices/${id}`;}
