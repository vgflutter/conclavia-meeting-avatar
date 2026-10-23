import type {PerformanceMood} from '@conclavia/avatar-kit/performance';

/** Product copy, never a breaking-news edition or a publication instruction. */
export const dailyLaunch={
 version:1,title:'CDaily · Il mondo corre',claim:'Meno rumore.\nPiù contesto.',
 description:'Il mondo corre. Conclavia Daily nasce per orientarsi tra le notizie: fatti, contesto e approfondimenti, raccontati con curiosità e un tono informale. Due edizioni, Italia e World. Il progetto punta a una redazione autonoma con ricerca, racconto e revisione editoriale AI: fonti verificabili, fatti distinti dalle opinioni, senza appartenenze politiche. Presentatore e voce AI. Segui Conclavia Daily sui social e su Spotify. https://daily.conclavia.me',
 voice:'Alex 2 - daily',model:'eleven_v4' as const,speakingRate:1,
 direction:'[Speak in native Italian as if explaining an interesting project to a friend. Easy, informal and brisk, with connected phrases and varied emphasis. Let curiosity come through without a constant smile. Keep the closing invitation friendly and unforced. No announcer cadence, dramatic pauses or advertising delivery.]',
 lines:[
  {scene:'hook',text:'Il mondo corre.',mood:'attention',intensity:.82},
  {scene:'hook',text:'Ma capire cosa succede non dovrebbe essere un secondo lavoro.',mood:'empathy',intensity:.7},
  {scene:'brand',text:'Questo è Conclavia Daily:',mood:'agreement',intensity:.76},
  {scene:'purpose',text:'le notizie che contano,',mood:'attention',intensity:.8},
  {scene:'purpose',text:'il contesto per capirle',mood:'curiosity',intensity:.82},
  {scene:'purpose',text:'e lo spazio per farti la tua idea.',mood:'agreement',intensity:.76},
  {scene:'method',text:'Italia e mondo: che cosa succede,',mood:'curiosity',intensity:.78},
  {scene:'method',text:'perché conta',mood:'attention',intensity:.76},
  {scene:'method',text:'e che cosa cambia rispetto a ieri.',mood:'curiosity',intensity:.8},
  {scene:'trust',text:'Stiamo costruendo una redazione AI che cerca, racconta e ricontrolla le notizie.',mood:'curiosity',intensity:.78},
  {scene:'trust',text:'Fonti verificabili,',mood:'attention',intensity:.76},
  {scene:'trust',text:'fatti distinti dalle opinioni.',mood:'agreement',intensity:.75},
  {scene:'invitation',text:'Senza appartenenze politiche.',mood:'attention',intensity:.76},
  {scene:'invitation',text:'Notizie ogni giorno e podcast di approfondimento.',mood:'curiosity',intensity:.8},
  {scene:'signature',text:'Segui Conclavia Daily sui social e su Spotify.',mood:'agreement',intensity:.85},
  {scene:'signature',text:'Meno rumore, più contesto.',mood:'agreement',intensity:.8},
 ] satisfies {scene:string;text:string;mood:PerformanceMood;intensity:number}[],
 scenes:[
  {id:'hook',kind:'statement' as const,kicker:'',lines:['Il mondo corre.']},
  {id:'brand',kind:'signature' as const,kicker:'',lines:['CDaily']},
  {id:'purpose',kind:'host' as const,kicker:'',lines:['Fatti, con contesto.']},
  {id:'method',kind:'cards' as const,kicker:'ITALIA / WORLD',lines:[],items:['Che cosa succede.','Perché conta.','Che cosa cambia.']},
  {id:'trust',kind:'host' as const,kicker:'',lines:['L’AI verifica l’AI.']},
  {id:'invitation',kind:'conversation' as const,kicker:'ANTEPRIMA · PODCAST',lines:['Podcast di','approfondimento.'],turns:[{speaker:0 as const,text:'Quanto tempo risparmiamo?',mood:'curiosity' as const},{speaker:1 as const,text:'E che cosa cambia nel lavoro?',mood:'doubt' as const}]},
  {id:'signature',kind:'signature' as const,kicker:'',lines:['CDaily']},
 ],
};
