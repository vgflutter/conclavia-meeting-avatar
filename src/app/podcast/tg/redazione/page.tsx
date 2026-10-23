import type { Metadata } from 'next';
import { TgNewsroom } from '@/components/tg/TgNewsroom';
export const metadata:Metadata={title:'Conclavia TG · Redazione e pubblicazione'};
export default function NewsroomPage(){return <TgNewsroom/>;}
