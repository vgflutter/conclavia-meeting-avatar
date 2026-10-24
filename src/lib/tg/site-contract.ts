import type {TgEdition} from './types';
export const DAILY_SITE_ORIGIN='https://daily.conclavia.me';
export function siteEditionPath(edition:TgEdition,date:string){
 if(!['it','world'].includes(edition)||!/^\d{4}-\d{2}-\d{2}$/u.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid public edition');
 return `/edizioni/${edition}/${date}/`;
}
