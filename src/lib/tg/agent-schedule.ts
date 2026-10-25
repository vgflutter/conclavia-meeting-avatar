import { parseProduct } from './config';
import { addCalendarDays, editionSlot, localEditionDate } from './schedule';
import type { TgProduct } from './types';

export interface DailyAgentSchedule {
  version:1; firstEditionDate:string; product:TgProduct;
  editorialModel?:'gpt-5.4'|'gpt-5.4-mini';
  productionDriver:'launchd'|'systemd'; publicationDriver:'chatgpt-work';
}
export function parseAgentSchedule(raw:unknown):DailyAgentSchedule {
  const value=raw as DailyAgentSchedule;
  const date=value?.firstEditionDate;
  if(value?.version!==1 || typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date ||
    !['launchd','systemd'].includes(value.productionDriver)||value.publicationDriver!=='chatgpt-work') throw new Error('Piano Daily non valido');
  if(value.editorialModel!==undefined&&!['gpt-5.4','gpt-5.4-mini'].includes(value.editorialModel))throw new Error('Modello editoriale Daily non supportato');
  const product=parseProduct(value.product);
  if(!product.productionTime||!product.automatic||product.publicationDriver!=='chatgpt-work') throw new Error('Il Daily richiede avvio esplicito e revisione AI, con pubblicazione Work separata');
  return {version:1,firstEditionDate:date,productionDriver:value.productionDriver,publicationDriver:'chatgpt-work',product,...(value.editorialModel?{editorialModel:value.editorialModel}:{})};
}
export function agentCalendar(plan:DailyAgentSchedule,now:Date,days=7) {
  const today=localEditionDate(now,plan.product.timezone);
  const first=today<plan.firstEditionDate?plan.firstEditionDate:today;
  return Array.from({length:days},(_,i)=>editionSlot(plan.product,addCalendarDays(first,i)));
}
export function agentDecision(plan:DailyAgentSchedule,now:Date) {
  const date=localEditionDate(now,plan.product.timezone),slot=editionSlot(plan.product,date);
  const reason=!plan.product.enabled?'disabled':date<plan.firstEditionDate?'before_first_edition':
    now.getTime()<Date.parse(slot.prepareAt)?'before_production':now.getTime()>Date.parse(slot.closesAt)?'closed':'due';
  return {date,slot,reason,due:reason==='due'};
}
