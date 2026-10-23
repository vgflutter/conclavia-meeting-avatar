import type { Metadata } from 'next';
import { TgStudio } from '@/components/tg/TgStudio';
export const metadata: Metadata = { title: 'Conclavia TG · La redazione' };
export default function TgPage() { return <TgStudio />; }
