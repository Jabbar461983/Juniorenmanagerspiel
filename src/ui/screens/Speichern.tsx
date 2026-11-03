import { useEffect, useState } from 'react';
import { exportiereJson, importiereJson, type SpeicherMeta } from '../../storage';
import { Badge, Karte, Leer } from '../components/Basis';
import type { SpielApi } from '../useSpiel';

export function Speichern({ spiel }: { spiel: SpielApi }) {
  const [staende, setStaende] = useState<SpeicherMeta[]>([]);
  const [name, setName] = useState(`${spiel.stand!.state.verein.name} – Saison ${spiel.stand!.state.saison}, Woche ${spiel.stand!.state.woche}`);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    spiel.repo.liste().then(setStaende).catch(() => setStaende([]));
  }, [spiel.repo, version, spiel.stand]);

  function exportieren() {
    const text = exportiereJson(spiel.stand!);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const s = spiel.stand!.state;
    a.download = `juniorenmanager-${s.verein.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-s${s.saison}w${s.woche}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importieren(datei: File | undefined) {
    if (!datei) return;
    try {
      await spiel.uebernehmen(importiereJson(await datei.text()));
      spiel.setMeldung('Spielstand importiert.');
      setVersion((v) => v + 1);
    } catch (err) {
      spiel.setMeldung((err as Error).message);
    }
  }

  return (
    <div className="stapel">
      <Karte titel="Speichern">
        <p className="klein">Das Spiel speichert automatisch nach jeder Woche und bei jeder Planung im aktuellen Speicherplatz.</p>
        <form
          className="formular-zeile"
          onSubmit={async (e) => {
            e.preventDefault();
            await spiel.speichernUnter(name);
            setVersion((v) => v + 1);
          }}
        >
          <label className="wachsen">
            Name des Speicherplatzes
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button className="knopf primaer" type="submit">
            Speichern unter …
          </button>
        </form>
        <div className="zeile">
          <button className="knopf" onClick={exportieren}>
            Als JSON exportieren
          </button>
          <label className="knopf datei-knopf">
            JSON importieren
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => importieren(e.target.files?.[0])} />
          </label>
          <button className="knopf" onClick={spiel.schliessen}>
            Zum Startbildschirm
          </button>
        </div>
      </Karte>
      <Karte titel="Spielstände auf diesem Gerät">
        {staende.length === 0 ? (
          <Leer>Keine Spielstände.</Leer>
        ) : (
          <ul className="liste">
            {staende.map((m) => (
              <li key={m.id} className="liste-zeile">
                <div>
                  <strong>{m.name}</strong> {m.id === spiel.stand!.meta.id && <Badge ton="gut">aktuell</Badge>}
                  <div className="klein">
                    {m.vereinsname} · Saison {m.saison}, Woche {m.woche} · {new Date(m.gespeichertAm).toLocaleString('de-CH')}
                  </div>
                </div>
                <div className="zeile">
                  <button className="knopf klein" disabled={m.id === spiel.stand!.meta.id} onClick={() => spiel.laden(m.id)}>
                    Laden
                  </button>
                  <button
                    className="knopf klein"
                    disabled={m.id === spiel.stand!.meta.id}
                    onClick={async () => {
                      if (window.confirm(`Spielstand «${m.name}» löschen?`)) {
                        await spiel.repo.loeschen(m.id);
                        setVersion((v) => v + 1);
                      }
                    }}
                  >
                    Löschen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Karte>
    </div>
  );
}
