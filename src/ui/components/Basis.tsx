import type { ReactNode } from 'react';

export function Karte({ titel, children, aktion, className }: { titel?: ReactNode; children: ReactNode; aktion?: ReactNode; className?: string }) {
  return (
    <section className={`karte ${className ?? ''}`}>
      {(titel || aktion) && (
        <header className="karte-kopf">
          {titel && <h2>{titel}</h2>}
          {aktion}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kennzahl({ label, wert, zusatz, ton }: { label: string; wert: ReactNode; zusatz?: ReactNode; ton?: 'gut' | 'warn' | 'schlecht' }) {
  return (
    <div className={`kennzahl ${ton ? `ton-${ton}` : ''}`}>
      <div className="kennzahl-label">{label}</div>
      <div className="kennzahl-wert">{wert}</div>
      {zusatz && <div className="kennzahl-zusatz">{zusatz}</div>}
    </div>
  );
}

/** Horizontaler Balken 0–max mit Zahl */
export function Balken({ wert, max = 100, label, ton }: { wert: number; max?: number; label?: string; ton?: 'auto' }) {
  const prozent = Math.max(0, Math.min(100, (wert / max) * 100));
  const klasse = ton === 'auto' ? (prozent > 66 ? 'gut' : prozent >= 34 ? 'mittel' : 'schlecht') : 'neutral';
  return (
    <div className="balken-zeile">
      {label && <span className="balken-label">{label}</span>}
      <span className="balken" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(wert)} aria-label={label}>
        <span className={`balken-fuellung ${klasse}`} style={{ width: `${prozent}%` }} />
      </span>
      <span className="balken-zahl">{Math.round(wert)}</span>
    </div>
  );
}

export function Delta({ wert, einheit = '', dezimal = 0 }: { wert: number; einheit?: string; dezimal?: number }) {
  const r = Number(wert.toFixed(dezimal));
  if (r === 0) return <span className="delta">±0{einheit}</span>;
  return (
    <span className={`delta ${r > 0 ? 'plus' : 'minus'}`}>
      {r > 0 ? '+' : '−'}
      {Math.abs(r).toFixed(dezimal)}
      {einheit}
    </span>
  );
}

export function Badge({ children, ton }: { children: ReactNode; ton?: 'warn' | 'gut' | 'info' | 'schlecht' }) {
  return <span className={`badge ${ton ? `badge-${ton}` : ''}`}>{children}</span>;
}

export function Leer({ children }: { children: ReactNode }) {
  return <p className="leer">{children}</p>;
}
