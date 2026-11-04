import type { ChronikEintrag, Endbewertung as EB } from '../../engine';
import { Balken } from './Basis';

export function Endbewertung({ eb }: { eb: EB }) {
  return (
    <div className="endbewertung">
      <p className="gross-text">
        {eb.punkte} von 100 Punkten – «{eb.titel}»
      </p>
      {eb.kriterien.map((k) => (
        <Balken key={k.id} label={`${k.name} (${Math.round(k.gewicht * 100)} %)`} wert={k.wert} ton="auto" />
      ))}
    </div>
  );
}

const ART_SYMBOL: Record<ChronikEintrag['art'], string> = {
  erfolg: '🏆',
  krise: '⚠',
  finanzen: 'CHF',
  vorstand: '§',
  verein: '•'
};

export function Chronik({ eintraege, max }: { eintraege: ChronikEintrag[]; max?: number }) {
  const liste = [...eintraege].reverse().slice(0, max ?? eintraege.length);
  if (liste.length === 0) return <p className="leer">Noch keine Einträge.</p>;
  return (
    <ol className="chronik">
      {liste.map((c, i) => (
        <li key={i} className={`chronik-${c.art}`}>
          <span className="chronik-zeit">
            S{c.saison} W{c.woche}
          </span>
          <span className="chronik-symbol" aria-hidden="true">
            {ART_SYMBOL[c.art]}
          </span>
          <span>{c.text}</span>
        </li>
      ))}
    </ol>
  );
}
