import { useEffect, useRef, useState } from 'react';
import { aktuelleWoche, chf, datumText, PHASEN_NAMEN } from '../engine';
import { useSpiel } from './useSpiel';
import { Start } from './screens/Start';
import { Uebersicht } from './screens/Uebersicht';
import { Posteingang } from './screens/Posteingang';
import { Teams } from './screens/Teams';
import { Personen } from './screens/Personen';
import { Finanzen } from './screens/Finanzen';
import { Wettkampf } from './screens/Wettkampf';
import { Wochenbericht } from './screens/Wochenbericht';
import { Speichern } from './screens/Speichern';

export type Ansicht = 'uebersicht' | 'posteingang' | 'teams' | 'personen' | 'finanzen' | 'wettkampf' | 'bericht' | 'speichern';

const NAV: { id: Ansicht; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'posteingang', label: 'Posteingang' },
  { id: 'teams', label: 'Teams' },
  { id: 'personen', label: 'Personen' },
  { id: 'finanzen', label: 'Finanzen' },
  { id: 'wettkampf', label: 'Kalender & Wettkampf' },
  { id: 'bericht', label: 'Wochenbericht' },
  { id: 'speichern', label: 'Speichern/Laden' }
];

export function App() {
  const spiel = useSpiel();
  const [ansicht, setAnsicht] = useState<Ansicht>('uebersicht');
  const [laeuft, setLaeuft] = useState(false);
  const hauptRef = useRef<HTMLElement>(null);

  useEffect(() => {
    hauptRef.current?.focus();
  }, [ansicht]);

  useEffect(() => {
    if (!spiel.meldung) return;
    const t = window.setTimeout(() => spiel.setMeldung(null), 5000);
    return () => window.clearTimeout(t);
  }, [spiel.meldung, spiel]);

  if (!spiel.stand || !spiel.ansicht) {
    return (
      <>
        <Start spiel={spiel} onGestartet={() => setAnsicht('uebersicht')} />
        {spiel.meldung && <div className="toast" role="status">{spiel.meldung}</div>}
      </>
    );
  }

  const state = spiel.stand.state;
  const info = aktuelleWoche(state);
  const ungelesen = state.posteingang.filter((n) => !n.gelesen).length;

  async function simulieren() {
    setLaeuft(true);
    const ok = await spiel.simulieren();
    setLaeuft(false);
    if (ok) setAnsicht('bericht');
  }

  const gesperrt = spiel.offenePflicht > 0 || !!state.spielende;

  return (
    <div className="app">
      <a className="skip-link" href="#hauptinhalt">Zum Inhalt springen</a>
      <header className="kopf">
        <div className="kopf-info">
          <div className="kopf-verein">{state.verein.name}</div>
          <div className="kopf-zeit">
            {state.spielende ? `Saison ${state.saison - 1} abgeschlossen` : `Saison ${state.saison} · Woche ${state.woche}/52 · ${datumText(info.montag)}`}
          </div>
          <div className="kopf-phase">
            {state.spielende ? 'Spielende' : PHASEN_NAMEN[info.phase]}
            {!state.spielende && info.ferien && <span className="badge badge-info">{info.ferien.name}</span>}
          </div>
        </div>
        <div className="kopf-aktion">
          <div className={`kopf-kasse ${state.finanzen.kasse < 0 ? 'negativ' : ''}`} aria-label="Kasse">
            {chf(state.finanzen.kasse)}
          </div>
          <button className="knopf primaer" onClick={simulieren} disabled={gesperrt || laeuft} aria-describedby="sim-hinweis">
            {laeuft ? 'Simuliere …' : 'Woche simulieren ▸'}
          </button>
          <div id="sim-hinweis" className="kopf-hinweis">
            {state.spielende ? (
              'Spiel beendet'
            ) : spiel.offenePflicht > 0 ? (
              <button className="link" onClick={() => setAnsicht('posteingang')}>
                {spiel.offenePflicht} Pflicht-Ereignis{spiel.offenePflicht === 1 ? '' : 'se'} offen
              </button>
            ) : spiel.stand.entwurf.length > 0 ? (
              `${spiel.stand.entwurf.length} Entscheid${spiel.stand.entwurf.length === 1 ? '' : 'e'} geplant`
            ) : (
              'bereit'
            )}
          </div>
        </div>
      </header>
      <nav className="navigation" aria-label="Hauptnavigation">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-knopf ${ansicht === n.id ? 'aktiv' : ''}`}
            aria-current={ansicht === n.id ? 'page' : undefined}
            onClick={() => setAnsicht(n.id)}
          >
            {n.label}
            {n.id === 'posteingang' && ungelesen > 0 && <span className="nav-zahl" aria-label={`${ungelesen} ungelesen`}>{ungelesen}</span>}
          </button>
        ))}
      </nav>
      {spiel.vorschauFehler.length > 0 && (
        <div className="hinweis warn" role="alert">
          {spiel.vorschauFehler.map((f, i) => (
            <div key={i}>{f}</div>
          ))}
        </div>
      )}
      <main id="hauptinhalt" ref={hauptRef} tabIndex={-1} className="inhalt">
        {ansicht === 'uebersicht' && <Uebersicht spiel={spiel} navigiere={setAnsicht} />}
        {ansicht === 'posteingang' && <Posteingang spiel={spiel} />}
        {ansicht === 'teams' && <Teams spiel={spiel} />}
        {ansicht === 'personen' && <Personen spiel={spiel} />}
        {ansicht === 'finanzen' && <Finanzen spiel={spiel} />}
        {ansicht === 'wettkampf' && <Wettkampf spiel={spiel} />}
        {ansicht === 'bericht' && <Wochenbericht spiel={spiel} />}
        {ansicht === 'speichern' && <Speichern spiel={spiel} />}
      </main>
      {spiel.meldung && (
        <div className="toast" role="status">
          {spiel.meldung}
        </div>
      )}
    </div>
  );
}
