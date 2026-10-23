import type { PerformanceMood } from '@conclavia/avatar-kit/performance';
export type CreativePilotId='dato'|'confronto'|'traccia';
export interface CreativeLine {text:string;mood:PerformanceMood;intensity:number;scene:string;speaker?:0|1}
export const pilotSource={label:'ILO–NASK · studio 2025',url:'https://www.ilo.org/publications/generative-ai-and-jobs-2025-update',publishedAt:'2025-05-20'};
/** Creative pilots, not current daily editions or publication instructions. */
export const creativePilots=[
 {id:'dato' as const,title:'Un lavoro su quattro. Che cosa significa?',format:'Un dato, il suo limite',hypothesis:'Offrire una spiegazione utile subito, con dato e limite visibili, per favorire salvataggi e follow.',
  sources:[pilotSource],voices:['Daily IT — Alex'],description:'Un numero cambia significato quando lo leggi con il suo contesto. Spieghiamo lo studio ILO–NASK del 2025 sull’esposizione potenziale del lavoro all’AI generativa. Esposizione non equivale a posti già persi. Presentatore e voce AI. Pilota di approfondimento, non notiziario di oggi. Fonti e data consultabili.',
  lines:[
   {scene:'hook',text:'Un lavoro su quattro. Sai che cosa significa davvero?',mood:'curiosity',intensity:.8},
   {scene:'dato',text:'Secondo uno studio internazionale del 2025, un lavoro su quattro è potenzialmente esposto all’AI generativa.',mood:'attention',intensity:.72},
   {scene:'limite',text:'Esposizione significa che la tecnologia può toccare le attività di una professione.',mood:'attention',intensity:.7},
   {scene:'limite',text:'Non significa che quel posto sparirà.',mood:'doubt',intensity:.76},
   {scene:'contesto',text:'Lo studio indica soprattutto una trasformazione del lavoro, perché molti compiti richiedono ancora un contributo umano.',mood:'empathy',intensity:.7},
   {scene:'domanda',text:'La domanda utile? Quali attività cambiano, e quali competenze servono?',mood:'curiosity',intensity:.84},
   {scene:'fine',text:'Su Conclavia Daily partiamo dai dati e andiamo oltre il titolo. Seguici.',mood:'agreement',intensity:.82},
  ] satisfies CreativeLine[],
  scenes:[
   {id:'hook',kind:'statement' as const,kicker:'AI E LAVORO · APPROFONDIMENTO PILOTA',lines:['Un lavoro','su quattro.'],support:'Sai che cosa significa davvero?'},
   {id:'dato',kind:'evidence' as const,kicker:'IL DATO',lines:['Potenzialmente','esposto.'],metric:{value:'1 su 4',label:'occupazioni con esposizione alla GenAI',cells:4,filled:1},support:'Una stima di esposizione, non un conteggio di licenziamenti.',source:pilotSource.label},
   {id:'limite',kind:'evidence' as const,kicker:'IL LIMITE',lines:['Esposizione','≠ perdita del posto'],metric:{value:'≠',label:'due misure diverse'},support:'Il numero non dice quanti posti di lavoro spariranno.',source:pilotSource.label},
   {id:'contesto',kind:'host' as const,kicker:'IL CONTESTO',lines:['Compiti che cambiano.','Persone che contano.'],support:'Trasformazione del lavoro: il risultato più probabile nello studio.'},
   {id:'domanda',kind:'cards' as const,kicker:'LA DOMANDA UTILE',lines:['Che cosa','cambia davvero?'],items:['Quali attività?','Quali competenze?'],support:'Prima il significato. Poi la tua idea.'},
   {id:'fine',kind:'signature' as const,kicker:'DATI / CONTESTO / LIMITI',lines:['Daily'],support:'Meno rumore. Più contesto.'},
  ]},
 {id:'confronto' as const,title:'Due AI. Una domanda scomoda.',format:'Il confronto che chiarisce',hypothesis:'Due interlocutori correggono una lettura superficiale senza inventare un litigio: test di attenzione e commenti pertinenti.',
  sources:[pilotSource],voices:['Daily IT — Alex','Roberta — Persuasive and Expressive'],description:'Due presentatori AI discutono il significato di un dato ILO–NASK del 2025. La domanda iniziale è un’interpretazione messa alla prova, non una previsione di posti persi. Un dialogo pilota scritto per rendere visibili domanda, fonte e limite. Nessun ospite umano o falso dibattito politico.',
  lines:[
   {scene:'dialogo',speaker:0,text:'Quindi l’AI farà sparire un lavoro su quattro?',mood:'doubt',intensity:.8},
   {scene:'dialogo',speaker:1,text:'Fermiamoci sul dato. Lo studio parla di esposizione potenziale, non di posti già persi.',mood:'disagreement',intensity:.74},
   {scene:'dialogo',speaker:0,text:'Allora basta imparare a usare un chatbot?',mood:'curiosity',intensity:.8},
   {scene:'dialogo',speaker:1,text:'È un salto in più. Le professioni sono fatte di tanti compiti, e il rapporto indica soprattutto una trasformazione.',mood:'attention',intensity:.74},
   {scene:'dialogo',speaker:0,text:'La domanda diventa: quali parti del lavoro cambiano davvero?',mood:'curiosity',intensity:.84},
   {scene:'dialogo',speaker:1,text:'Esatto. Su Daily vogliamo fare così: domande scomode, fonti visibili e spazio ai limiti.',mood:'agreement',intensity:.8},
   {scene:'fine',speaker:0,text:'Segui Conclavia Daily. La prossima domanda la porti tu.',mood:'agreement',intensity:.82},
  ] satisfies CreativeLine[],
  scenes:[
   {id:'dialogo',kind:'conversation' as const,spoken:true,speakerNames:['Alex','Roberta'] as [string,string],kicker:'AI E LAVORO · DIALOGO PILOTA',lines:['Un numero.','Due letture.'],support:'Esposizione ≠ posti persi · ILO–NASK · studio 2025',items:['DOMANDA','FONTE','LIMITE'],turns:[{speaker:0 as const,text:'Un lavoro su quattro?',mood:'doubt' as const},{speaker:1 as const,text:'Esposizione. Non posti persi.',mood:'disagreement' as const},{speaker:0 as const,text:'Basta un chatbot?',mood:'curiosity' as const},{speaker:1 as const,text:'Cambiano i compiti.',mood:'attention' as const},{speaker:0 as const,text:'Quali attività cambiano?',mood:'curiosity' as const},{speaker:1 as const,text:'Fonte, domanda, limite.',mood:'agreement' as const}]},
   {id:'fine',kind:'signature' as const,kicker:'LA PROSSIMA DOMANDA LA PORTI TU.',lines:['Daily'],support:'Meno rumore. Più contesto.'},
  ]},
 {id:'traccia' as const,title:'Una notizia può cambiare. Daily la segue.',format:'La traccia della notizia',hypothesis:'Un manifesto corto con una promessa di continuità e correzioni trasparenti, da confrontare con i piloti informativi.',
  sources:[],voices:['Daily IT — Alex'],description:'La direzione di Conclavia Daily: seguire gli sviluppi di una notizia, mostrare le fonti, distinguere ciò che sappiamo da ciò che resta aperto. Presentatori, voce e produzione AI; revisione AI separata come obiettivo operativo del progetto. Pilota creativo: il servizio quotidiano autonomo non è ancora attivo.',
  lines:[
   {scene:'hook',text:'Una notizia non finisce quando la pubblichi.',mood:'attention',intensity:.82},
   {scene:'cambia',text:'Domani può arrivare un dato nuovo, una smentita, una correzione.',mood:'curiosity',intensity:.78},
   {scene:'traccia',text:'E allora vogliamo mostrarti che cosa è cambiato, con le fonti e con i dubbi ancora aperti.',mood:'empathy',intensity:.74},
   {scene:'metodo',text:'È la direzione di Conclavia Daily: un’AI racconta, un’altra controlla.',mood:'attention',intensity:.76},
   {scene:'metodo',text:'Italia e mondo, in pochi minuti.',mood:'agreement',intensity:.8},
   {scene:'fine',text:'Seguici. Meno rumore, più contesto.',mood:'agreement',intensity:.85},
  ] satisfies CreativeLine[],
  scenes:[
   {id:'hook',kind:'statement' as const,kicker:'UNA NOTIZIA HA UNA STORIA.',lines:['Il titolo','può cambiare.'],support:'Anche il contesto deve seguirlo.'},
   {id:'cambia',kind:'cards' as const,kicker:'IL GIORNO DOPO',lines:['Un nuovo dato.','Una nuova lettura.'],items:['Aggiornamento','Smentita','Correzione'],support:'Esempio del metodo · nessun evento di cronaca simulato'},
   {id:'traccia',kind:'evidence' as const,kicker:'LA TRACCIA DELLA NOTIZIA',lines:['Che cosa sappiamo.','Che cosa manca.'],metric:{value:'Δ',label:'il cambiamento, reso visibile'},support:'Fonti collegate. Dubbi espliciti. Correzioni riconoscibili.',source:'OBIETTIVO EDITORIALE · IN SVILUPPO'},
   {id:'metodo',kind:'host' as const,kicker:'IL PROGETTO',lines:['L’AI racconta.','L’AI ricontrolla.'],support:'Italia e World · due edizioni · un metodo trasparente'},
   {id:'fine',kind:'signature' as const,kicker:'SEGUI IL PROGETTO.',lines:['Daily'],support:'Meno rumore. Più contesto.'},
  ]},
];
export function creativePilot(id:string){const pilot=creativePilots.find(p=>p.id===id);if(!pilot)throw Error('Pilota creativo non valido');return pilot;}
