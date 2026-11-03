import { useEffect, useState } from 'react';
import { B, FERIEN_REGION } from '../../engine';
import { importiereJson, type SpeicherMeta } from '../../storage';
import type { SpielApi } from '../useSpiel';
import { Karte } from '../components/Basis';

type Stufe = keyof typeof B.spiel.schwierigkeit;
const SCHWIERIGKEIT: { id: Stufe; name: string; text: string }[] = [
  { id: 'leicht', name: 'Leicht', text: 'Komfortables Polster' },
  { id: 'normal', name: 'Normal', text: 'Knapp, aber spielbar' },
  { id: 'schwer', name: 'Schwer', text: 'Jeder Franken zählt' }
];

function zufallsSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function Start({ spiel, onGestartet }: { spiel: SpielApi; onGestartet: () => void }) {
  const [name, setName] = useState('SHC Bärgwald');
  const [laufzeit, setLaufzeit] = useState(B.spiel.laufzeitStandard);
  const [schwierigkeit, setSchwierigkeit] = useState<Stufe>('normal');
  const [budget, setBudget] = useState<number>(B.spiel.startbudgetStandard);
  const [seed, setSeed] = useState<number>(zufallsSeed);
  const [staende, setStaende] = useState<SpeicherMeta[]>([]);

  useEffect(() => {
    spiel.repo.liste().then(setStaende).catch(() => setStaende([]));
  }, [spiel.repo]);

  function waehleSchwierigkeit(s: Stufe) {
    setSchwierigkeit(s);
    setBudget(B.spiel.schwierigkeit[s]);
  }

  async function starten(e: React.FormEvent) {
    e.preventDefault();
    await spiel.neues({ vereinsname: name, laufzeit, startbudget: budget, seed });
    onGestartet();
  }

  async function importieren(datei: File | undefined) {
    if (!datei) return;
    try {
      const stand = importiereJson(await datei.text());
      await spiel.uebernehmen(stand);
      onGestartet();
    } catch (err) {
      spiel.setMeldung((err as Error).message);
    }
  }

  return (
    <main className="start" id="hauptinhalt">
      <div className="start-kopf">
        <h1>Juniorenmanager</h1>
        <p>
          Du bist Juniorenverantwortliche:r eines Streethockey-Vereins. Baue über mehrere Saisons eine Juniorenabteilung nach den
          Grundsätzen von Jugend+Sport auf – mit möglichst vielen und möglichst glücklichen Junior:innen.
        </p>
      </div>
      <div className="start-raster">
        <Karte titel="Neues Spiel">
          <form onSubmit={starten} className="formular">
            <label>
              Vereinsname
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
            </label>
            <label>
              Laufzeit in Saisons
              <input type="number" min={1} max={20} value={laufzeit} onChange={(e) => setLaufzeit(Number(e.target.value))} />
              <small>In Etappe 1 endet das Spiel nach der ersten Saison mit einer vorläufigen Bewertung.</small>
            </label>
            <fieldset>
              <legend>Schwierigkeit</legend>
              <div className="wahl-gruppe">
                {SCHWIERIGKEIT.map((s) => (
                  <label key={s.id} className={`wahl ${schwierigkeit === s.id ? 'gewaehlt' : ''}`}>
                    <input type="radio" name="schwierigkeit" checked={schwierigkeit === s.id} onChange={() => waehleSchwierigkeit(s.id)} />
                    <span className="wahl-titel">{s.name}</span>
                    <span className="wahl-text">
                      CHF {B.spiel.schwierigkeit[s.id].toLocaleString('de-CH')} · {s.text}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Startbudget in CHF
              <input type="number" min={0} step={500} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </label>
            <details>
              <summary>Erweitert</summary>
              <label>
                Seed (Zufallsstartwert)
                <span className="zeile">
                  <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
                  <button type="button" className="knopf" onClick={() => setSeed(zufallsSeed())}>
                    Neu würfeln
                  </button>
                </span>
                <small>Gleicher Seed und gleiche Entscheide ergeben den gleichen Spielverlauf.</small>
              </label>
              <p className="klein">Schulferien: {FERIEN_REGION}</p>
            </details>
            <button className="knopf primaer gross" type="submit">
              Spiel starten
            </button>
          </form>
        </Karte>
        <Karte titel="Weiterspielen">
          {staende.length === 0 ? (
            <p className="leer">Noch keine Spielstände auf diesem Gerät.</p>
          ) : (
            <ul className="liste">
              {staende.map((m) => (
                <li key={m.id} className="liste-zeile">
                  <div>
                    <strong>{m.name}</strong>
                    <div className="klein">
                      {m.vereinsname} · Saison {m.saison}, Woche {m.woche} · {new Date(m.gespeichertAm).toLocaleString('de-CH')}
                    </div>
                  </div>
                  <button
                    className="knopf"
                    onClick={async () => {
                      await spiel.laden(m.id);
                      onGestartet();
                    }}
                  >
                    Laden
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="datei-import">
            Spielstand importieren (JSON)
            <input type="file" accept="application/json,.json" onChange={(e) => importieren(e.target.files?.[0])} />
          </label>
        </Karte>
      </div>
    </main>
  );
}
