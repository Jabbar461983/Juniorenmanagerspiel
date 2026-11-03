// Portrait: zeigt ein Foto aus dem Bildpool (public/portraits/), falls vorhanden,
// sonst einen neutralen Platzhalter (Silhouette mit Hautton und Initialen).
// Die Stimmung (froh/neutral/bedrückt) wird über Rahmenfarbe und Symbol gezeigt.
import { useEffect, useState } from 'react';
import type { Hautton, PortraitMeta, Stimmung } from '../../engine';

interface PoolBild {
  gruppe: string;
  nummer: number;
  geschlecht: string;
  hautton: string;
}

let poolLaden: Promise<PoolBild[]> | null = null;
function bildpool(): Promise<PoolBild[]> {
  if (!poolLaden) {
    poolLaden = fetch(`${import.meta.env.BASE_URL}portraits/portraits.json`)
      .then((r) => (r.ok ? r.json() : { bilder: [] }))
      .then((d: { bilder?: PoolBild[] }) => d.bilder ?? [])
      .catch(() => []);
  }
  return poolLaden;
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Wählt ein passendes Bild aus dem Pool (stabil pro Person). */
export function poolBildFuer(pool: PoolBild[], meta: PortraitMeta, personId: string): PoolBild | null {
  const passend = pool.filter((b) => b.gruppe === meta.gruppe && b.geschlecht === meta.geschlecht);
  const gleicherTon = passend.filter((b) => b.hautton === meta.hautton);
  const auswahl = gleicherTon.length > 0 ? gleicherTon : passend;
  if (auswahl.length === 0) return null;
  if (meta.nummer > 0) {
    const fix = auswahl.find((b) => b.nummer === meta.nummer);
    if (fix) return fix;
  }
  return auswahl[hash(personId) % auswahl.length]!;
}

const HAUTTOENE: Record<Hautton, string> = {
  hell: '#f1d3bd',
  'hell-mittel': '#e0b48f',
  mittel: '#c48c62',
  'mittel-dunkel': '#8f5d3b',
  dunkel: '#5a3a26'
};

const STIMMUNG_TEXT: Record<Stimmung, string> = { froh: 'froh', neutral: 'neutral', bedrueckt: 'bedrückt' };
const STIMMUNG_SYMBOL: Record<Stimmung, string> = { froh: '☺', neutral: '•', bedrueckt: '☹' };

interface Props {
  meta: PortraitMeta;
  personId: string;
  vorname: string;
  nachname: string;
  stimmung?: Stimmung;
  groesse?: number;
}

export function Portrait({ meta, personId, vorname, nachname, stimmung, groesse = 56 }: Props) {
  const [bild, setBild] = useState<PoolBild | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let aktiv = true;
    bildpool().then((pool) => {
      if (aktiv) setBild(poolBildFuer(pool, meta, personId));
    });
    return () => {
      aktiv = false;
    };
  }, [meta, personId]);

  const initialen = `${vorname[0] ?? ''}${nachname[0] ?? ''}`.toUpperCase();
  const st = stimmung ?? 'neutral';
  const label = `Portrait ${vorname} ${nachname}${stimmung ? `, Stimmung ${STIMMUNG_TEXT[st]}` : ''}`;
  const datei = bild
    ? `${import.meta.env.BASE_URL}portraits/${bild.gruppe}_${String(bild.nummer).padStart(3, '0')}_${st}.webp`
    : null;

  return (
    <div className={`portrait stimmung-${stimmung ?? 'keine'}`} style={{ width: groesse, height: groesse }} role="img" aria-label={label}>
      {datei && !fehler ? (
        <img src={datei} alt="" width={groesse} height={groesse} onError={() => setFehler(true)} />
      ) : (
        <svg viewBox="0 0 64 64" width={groesse} height={groesse} aria-hidden="true">
          <rect width="64" height="64" fill="var(--portrait-bg)" />
          <circle cx="32" cy="25" r={meta.gruppe === 'kind' ? 13 : 12} fill={HAUTTOENE[meta.hautton]} />
          <path d={`M10 64 C10 ${meta.gruppe === 'kind' ? 46 : 44} 20 40 32 40 C44 40 54 ${meta.gruppe === 'kind' ? 46 : 44} 54 64 Z`} fill={HAUTTOENE[meta.hautton]} opacity="0.85" />
          <text x="32" y="29.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(0,0,0,0.65)">
            {initialen}
          </text>
        </svg>
      )}
      {stimmung && (
        <span className="portrait-symbol" aria-hidden="true">
          {STIMMUNG_SYMBOL[st]}
        </span>
      )}
    </div>
  );
}
