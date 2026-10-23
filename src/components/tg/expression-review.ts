import {names, type PodcastEmotion} from '@conclavia/avatar-kit/performance';
import type {TgFrame} from '@conclavia/avatar-kit/formats/tg';

// Product review fixtures only. Anatomy and transition interpolation stay in
// the shared renderer; this page supplies the same speaker inputs as a show.
export const expressionStates = ['attention', 'curiosity', 'doubt', 'agreement', 'amusement', 'empathy', 'disagreement', 'surprise', 'listening'] as const;
export type ExpressionState = typeof expressionStates[number];
export const expressionNames: Record<ExpressionState, string> = {...names, listening: 'Ascolto neutro'};
export const expressionDetails: Record<ExpressionState, string> = {
  attention: 'Sguardo aperto, sopracciglia distese, bocca rilassata.',
  curiosity: 'Sopracciglia asimmetriche, occhi più aperti, testa inclinata.',
  doubt: 'Un sopracciglio sollevato, palpebre raccolte, labbra più tese.',
  agreement: 'Sorriso contenuto, guance sollevate e sguardo morbido.',
  amusement: 'Sorriso più ampio, guance attive e occhi leggermente socchiusi.',
  empathy: 'Parte interna delle sopracciglia sollevata e sguardo più basso.',
  disagreement: 'Sopracciglia ravvicinate, occhi più stretti e labbra compresse.',
  surprise: 'Sopracciglia alte, occhi aperti e lieve arretramento della testa.',
  listening: 'Intensità emotiva azzerata, bocca chiusa e piccoli movimenti di presenza.',
};
export const expressionPairs = expressionStates.flatMap(from => expressionStates.filter(to => from !== to).map(to => ({from, to, id: `${from}--${to}`})));
export const expressionTiming = {change: 1.3, duration: 4.4, fps: 60} as const;

export function expressionReviewFrame(from: ExpressionState, to: ExpressionState, seconds: number, body = false): TgFrame {
  const state = seconds < expressionTiming.change ? from : to;
  const emotion: PodcastEmotion = state === 'listening' ? 'attention' : state;
  return {
    brand: 'Conclavia Daily', edition: 'Italia', date: 'PROVA ESPRESSIONI', demo: true,
    headline: 'Espressioni e transizioni', context: 'Prova visiva senza audio.',
    change: '', sources: [], story: 1, totalStories: 1,
    seconds, duration: expressionTiming.duration, portrait: false,
    speakers: [{name: 'Daily', emotion, intensity: state === 'listening' ? 0 : .84,
      speaking: body && state !== 'listening', viseme: 'rest', audioLevel: 0,
      performance: {cueId: body ? `body:${from}:${to}` : state, progress: body ? seconds / expressionTiming.duration : .45, durationSeconds: 4.4, listening: !body || state === 'listening', gaze: 'camera', phase: 'delivery'},
    }],
  };
}

export const bodyDetails:Record<ExpressionState,string>={
 attention:'Palmo che accompagna la spiegazione, accento di precisione della mano opposta.',
 curiosity:'Palmi offerti, busto verso l’interlocutore e inclinazione della testa.',
 doubt:'Un palmo interrogativo, indice della mano opposta e lieve arretramento.',
 agreement:'Cenno del capo e mano aperta di accompagnamento.',
 amusement:'Gesti più larghi, spalle sciolte e piccola risposta del busto.',
 empathy:'Una mano verso il petto, l’altra offerta; postura raccolta e ritmo morbido.',
 disagreement:'Palmo verticale contenuto, lieve rotazione della testa e busto più fermo.',
 surprise:'Due palmi aperti, spalle sollevate e piccolo arretramento, poi recupero.',
 listening:'Mani a riposo, sguardo presente e movimenti di ascolto contenuti.',
};
