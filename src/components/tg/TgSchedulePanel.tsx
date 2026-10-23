'use client';
import { useState } from 'react';
import { localEditionDate, type TgSlot } from '@/lib/tg/schedule';
import { TG_STATE_NAMES } from '@/lib/tg/presentation';
import styles from './TgNewsroom.module.css';

const clock = (at: string, timezone: string) => new Intl.DateTimeFormat('it-IT', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
export function TgSchedulePanel({ slots, now, onSelect }: { slots: TgSlot[]; now: string; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const dates = [...new Set(slots.map(s => s.date))].sort(), visible = expanded ? dates : dates.slice(0, 3);
  return <section className={`${styles.panel} ${styles.calendar}`} aria-label="Calendario delle uscite">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>IL PALINSESTO · PROSSIMI SETTE GIORNI</p><h2>Prossime uscite</h2><p>Avvio della creazione e uscita sono distinti. Gli orari sono locali; la finestra di pubblicazione si chiude dopo 30 minuti.</p></div><button className={styles.secondary} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Mostra tre giorni' : 'Mostra sette giorni'}</button></div>
    <div className={styles.calendarDays}>{visible.map(date => <article className={styles.calendarDay} key={date}>
      <h3>{new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'))}</h3>
      {slots.filter(s => s.date === date).map(slot => {
        const missed = !slot.jobId && slot.enabled && Date.parse(now) > Date.parse(slot.closesAt);
        return <div className={`${styles.calendarSlot} ${!slot.enabled && !slot.jobId ? styles.calendarDisabled : ''}`} key={slot.edition}>
          <span className={styles.eyebrow}>{slot.edition === 'it' ? 'ITALIA · IT' : 'WORLD · EN'}</span>
          <strong><time dateTime={slot.scheduledAt}>{clock(slot.scheduledAt, slot.timezone)}</time><small>{slot.timezone}</small></strong>
          <p>{slot.state ? TG_STATE_NAMES[slot.state] : !slot.enabled ? 'Preparazione disattivata' : missed ? 'Finestra saltata' : 'Pianificata · da preparare'}</p>
          <small>Avvio {clock(slot.prepareAt, slot.timezone)}{localEditionDate(new Date(slot.prepareAt),slot.timezone) !== slot.date ? ' · giorno precedente' : ''}</small>
          <small>{slot.automatic ? 'Revisore finale AI' : 'Modalità assistita'}</small>
          {slot.adjusted && <p className={styles.warning}>Cambio dell’ora: prima occorrenza valida</p>}
          {slot.jobId && <button className={styles.calendarLink} onClick={() => onSelect(slot.jobId!)}>Apri edizione →</button>}
        </div>;
      })}
    </article>)}</div>
    <p className={styles.hint}>Le caselle future sono una previsione, non video già creati. Attivare la preparazione non attiva gli invii ai social. Le edizioni già accodate conservano la propria configurazione.</p>
  </section>;
}
