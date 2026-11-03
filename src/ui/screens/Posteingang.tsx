import { useState } from 'react';
import { ereignisVorlage, optionText, type EreignisInstanz, type GameState, type Nachricht } from '../../engine';
import { Badge, Karte, Leer } from '../components/Basis';
import type { SpielApi } from '../useSpiel';

function EreignisKarte({ spiel, inst, s }: { spiel: SpielApi; inst: EreignisInstanz; s: GameState }) {
  const gewaehlt = spiel.stand!.entwurf.find((e) => e.typ === 'ereignis' && e.ereignisId === inst.id) as
    | { optionId: string }
    | undefined;
  const vorlage = ereignisVorlage(inst.vorlageId);
  return (
    <div className="ereignis">
      <div className="ereignis-kopf">
        <h3>{inst.titel}</h3>
        {inst.pflicht ? <Badge ton="warn">Pflicht</Badge> : <Badge>freiwillig</Badge>}
        <Badge ton="info">{vorlage.kategorie}</Badge>
      </div>
      <p>{inst.text}</p>
      {inst.erledigt ? (
        <p className="folge">
          <strong>Entschieden:</strong> {optionText(s, inst, inst.erledigt.optionId)} – {inst.erledigt.text}
        </p>
      ) : (
        <fieldset className="optionen">
          <legend className="sr-only">Antwort wählen</legend>
          {vorlage.optionen.map((o) => {
            const verfuegbar = inst.verfuegbareOptionen.includes(o.id);
            return (
              <label key={o.id} className={`option ${gewaehlt?.optionId === o.id ? 'gewaehlt' : ''} ${verfuegbar ? '' : 'deaktiviert'}`}>
                <input
                  type="radio"
                  name={`ev-${inst.id}`}
                  disabled={!verfuegbar}
                  checked={gewaehlt?.optionId === o.id}
                  onChange={() => spiel.entscheiden({ typ: 'ereignis', ereignisId: inst.id, optionId: o.id })}
                />
                <span>{optionText(s, inst, o.id)}</span>
                {!verfuegbar && <span className="klein"> (nicht möglich)</span>}
              </label>
            );
          })}
          {!inst.pflicht && !gewaehlt && (
            <p className="klein">Ohne Entscheid gilt nach zwei Wochen: «{optionText(s, inst, vorlage.standardOption)}».</p>
          )}
        </fieldset>
      )}
    </div>
  );
}

export function Posteingang({ spiel }: { spiel: SpielApi }) {
  const s = spiel.stand!.state;
  const [filter, setFilter] = useState<'alle' | 'offen'>('offen');
  const [offenId, setOffenId] = useState<string | null>(null);
  const offene = s.ereignisse.filter((e) => !e.erledigt).sort((a, b) => Number(b.pflicht) - Number(a.pflicht));
  const nachrichten = [...s.posteingang].reverse().filter((n) => filter === 'alle' || !n.gelesen || (n.ereignisId && offene.some((e) => e.id === n.ereignisId)));

  function oeffnen(n: Nachricht) {
    setOffenId(offenId === n.id ? null : n.id);
    // Gelesen-Markierung ist kein Spielentscheid und wirkt sofort
    if (!n.gelesen && !n.ereignisId) spiel.gelesen(n.id);
  }

  return (
    <div className="stapel">
      <Karte titel={`Offene Ereignisse (${offene.length})`}>
        {offene.length === 0 ? <Leer>Keine offenen Ereignisse.</Leer> : offene.map((inst) => <EreignisKarte key={inst.id} spiel={spiel} inst={inst} s={s} />)}
      </Karte>
      <Karte
        titel="Nachrichten"
        aktion={
          <div className="segment" role="group" aria-label="Filter">
            <button className={filter === 'offen' ? 'aktiv' : ''} aria-pressed={filter === 'offen'} onClick={() => setFilter('offen')}>
              Neu
            </button>
            <button className={filter === 'alle' ? 'aktiv' : ''} aria-pressed={filter === 'alle'} onClick={() => setFilter('alle')}>
              Alle
            </button>
          </div>
        }
      >
        {nachrichten.length === 0 ? (
          <Leer>Keine neuen Nachrichten.</Leer>
        ) : (
          <ul className="nachrichten">
            {nachrichten.map((n) => {
              const inst = n.ereignisId ? s.ereignisse.find((e) => e.id === n.ereignisId) : undefined;
              return (
                <li key={n.id} className={`nachricht ${n.gelesen ? '' : 'ungelesen'} ${n.wichtig ? 'wichtig' : ''}`}>
                  <button className="nachricht-kopf" aria-expanded={offenId === n.id} onClick={() => oeffnen(n)}>
                    <span className="nachricht-titel">{n.titel}</span>
                    <span className="klein">
                      {n.absender} · S{n.saison} W{n.woche}
                    </span>
                  </button>
                  {offenId === n.id && (
                    <div className="nachricht-text">
                      <p>{n.text}</p>
                      {inst?.erledigt && <p className="folge">{inst.erledigt.text}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Karte>
    </div>
  );
}
