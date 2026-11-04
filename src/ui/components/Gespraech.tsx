// Gesprächsfenster (Etappe 2): führt einen Dialog Schritt für Schritt.
// Die Antworten werden erst beim Abschliessen als Entscheid gespeichert und
// wirken bei «Woche simulieren».
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  B,
  dialogAuswerten,
  infosVon,
  name,
  personVon,
  stimmungAus,
  vorschau,
  type Beteiligte,
  type Entscheid,
  type Ton
} from '../../engine';
import type { SpielApi } from '../useSpiel';
import { Portrait } from './Portrait';

export const TON_NAMEN: Record<Ton, { name: string; symbol: string }> = {
  empathisch: { name: 'empathisch', symbol: '♥' },
  sachlich: { name: 'sachlich', symbol: '≡' },
  bestimmt: { name: 'bestimmt', symbol: '!' },
  ausweichend: { name: 'ausweichend', symbol: '~' }
};

interface Props {
  spiel: SpielApi;
  dialogId: string;
  personId: string;
  /** gesetzt, wenn das Gespräch aus einem Ereignis kommt */
  ereignis?: { id: string; optionId: string; beteiligte: Beteiligte };
  schliessen: () => void;
}

export function Gespraech({ spiel, dialogId, personId, ereignis, schliessen }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [antworten, setAntworten] = useState<string[]>([]);

  // Ausgangslage: Spielstand mit allen geplanten Entscheiden ausser früheren Versionen dieses Gesprächs
  const basis = useMemo(() => {
    const stand = spiel.stand!;
    const ohne = stand.entwurf.filter(
      (e) => !(e.typ === 'dialog' && (ereignis ? e.ereignisId === ereignis.id : e.personId === personId && !e.ereignisId)) && e.typ !== 'ereignis'
    );
    return vorschau(stand.state, ohne).state;
  }, [spiel.stand, personId, ereignis]);

  const z = useMemo(() => dialogAuswerten(basis, dialogId, personId, antworten, ereignis?.beteiligte ?? {}), [basis, dialogId, personId, antworten, ereignis]);
  const person = personVon(basis, personId);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
  }, []);

  if (!person) return null;
  const grundstimmung =
    person.rolle === 'kind'
      ? person.zufriedenheit
      : person.rolle === 'elternteil'
        ? person.stimmung
        : person.rolle === 'trainer'
          ? 50 + person.motivation * 2
          : 50 + person.haltung / 2;
  const stimmung = stimmungAus(Math.max(0, Math.min(100, grundstimmung + (z.vertrauen - z.vertrauenStart) * 1.5)));
  const infoTitel = (schluessel: string) => infosVon(basis, person).find((i) => i.schluessel === schluessel);

  function abschliessen() {
    const d: Entscheid = { typ: 'dialog', dialogId, personId, antworten, ...(ereignis ? { ereignisId: ereignis.id } : {}) };
    if (ereignis) spiel.entscheidenMehrere([{ typ: 'ereignis', ereignisId: ereignis.id, optionId: ereignis.optionId }, d]);
    else spiel.entscheiden(d);
    ref.current?.close();
  }

  const vertrauenProzent = (z.vertrauen + 100) / 2;

  return (
    <dialog ref={ref} className="detail gespraech" onClose={schliessen} aria-labelledby="gespraech-titel">
      <div className="detail-kopf">
        <Portrait meta={person.portrait} personId={person.id} vorname={person.vorname} nachname={person.nachname} stimmung={stimmung} groesse={72} />
        <div>
          <h2 id="gespraech-titel">{z.dialog.titel}</h2>
          <p className="klein">mit {name(person)}</p>
        </div>
        <button className="knopf klein schliessen" onClick={() => ref.current?.close()} aria-label="Gespräch abbrechen">
          ✕
        </button>
      </div>
      <div className="vertrauen" aria-label={`Vertrauen ${Math.round(z.vertrauen)}`}>
        <span className="klein">Vertrauen</span>
        <span className="vertrauen-skala" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(z.vertrauen)}>
          <span className="vertrauen-mitte" />
          <span className="vertrauen-marke" style={{ left: `${vertrauenProzent}%` }} />
        </span>
        <span className="vertrauen-zahl">
          {Math.round(z.vertrauen)}
          {z.vertrauen !== z.vertrauenStart && (
            <span className={z.vertrauen > z.vertrauenStart ? 'positiv' : 'negativ'}>
              {' '}
              ({z.vertrauen > z.vertrauenStart ? '+' : '−'}
              {Math.abs(Math.round(z.vertrauen - z.vertrauenStart))})
            </span>
          )}
        </span>
      </div>

      <ol className="gespraech-verlauf" aria-live="polite">
        {z.verlauf.map((v, i) => (
          <li key={i}>
            <p className="sprechblase gegenueber">{v.frage}</p>
            <p className="sprechblase ich">
              <span className="ton" title={TON_NAMEN[v.ton].name} aria-label={`Ton: ${TON_NAMEN[v.ton].name}`}>
                {TON_NAMEN[v.ton].symbol}
              </span>{' '}
              {v.antwort}
            </p>
          </li>
        ))}
      </ol>

      {z.fehler && <p className="hinweis warn">{z.fehler}</p>}

      {!z.beendet && z.frage && (
        <>
          <p className="sprechblase gegenueber aktuell">{z.frage}</p>
          <div className="gespraech-antworten" role="group" aria-label="Antwort wählen">
            {z.antworten.map((a) => (
              <button key={a.id} className={`antwort ton-${a.ton}`} disabled={!a.moeglich} onClick={() => setAntworten([...antworten, a.id])}>
                <span className="antwort-ton">
                  {TON_NAMEN[a.ton].symbol} {TON_NAMEN[a.ton].name}
                </span>
                <span>{a.text}</span>
                {!a.moeglich && <span className="klein"> (nicht möglich)</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {z.beendet && (
        <div className="gespraech-ende">
          <p className="folge">{z.endText}</p>
          {z.offenbart.length > 0 && (
            <div className="hinweis">
              <strong>Du erfährst:</strong>
              <ul>
                {z.offenbart
                  .map((s) => infoTitel(s))
                  .filter((i) => !!i)
                  .map((i) => (
                    <li key={i!.schluessel}>
                      {i!.titel}: {i!.text}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <p className="klein">Das Gespräch wirkt, sobald du die Woche simulierst.</p>
        </div>
      )}

      <div className="zeile gespraech-knoepfe">
        {antworten.length > 0 && (
          <button className="knopf" onClick={() => setAntworten([])}>
            Neu beginnen
          </button>
        )}
        {z.beendet && !z.fehler && (
          <button className="knopf primaer" onClick={abschliessen}>
            Gespräch übernehmen
          </button>
        )}
      </div>
      <p className="klein">
        Pro Woche sind {B.dialog.gespraecheProWoche} Gespräche möglich. Gespräche aus Ereignissen zählen nicht dazu.
      </p>
    </dialog>
  );
}
