import { useState } from 'react';
import {
  PHASEN_NAMEN,
  aktuelleRunde,
  datumText,
  playoffRundeName,
  saisonJahr,
  saisonKalender,
  tabelle,
  type GameState,
  type Spiel,
  type WettkampfTeam
} from '../../engine';
import { Badge, Karte, Leer } from '../components/Basis';
import type { SpielApi } from '../useSpiel';

type Reiter = 'kalender' | 'U9' | 'U12' | 'U15' | 'U18';

function Tabelle({ teams, spiele, markiere }: { teams: WettkampfTeam[]; spiele: Spiel[]; markiere?: number }) {
  const tab = tabelle(teams, spiele);
  return (
    <div className="tabelle-huelle">
      <table className="tabelle">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Team</th>
            <th scope="col" className="zahl">Sp</th>
            <th scope="col" className="zahl">S</th>
            <th scope="col" className="zahl">U</th>
            <th scope="col" className="zahl">N</th>
            <th scope="col" className="zahl">Tore</th>
            <th scope="col" className="zahl">Pkt</th>
          </tr>
        </thead>
        <tbody>
          {tab.map((z, i) => (
            <tr key={z.id} className={`${z.eigen ? 'eigen' : ''} ${markiere && i === markiere - 1 ? 'strich' : ''}`}>
              <td>{i + 1}</td>
              <th scope="row">{z.name}</th>
              <td className="zahl">{z.spiele}</td>
              <td className="zahl">{z.siege}</td>
              <td className="zahl">{z.unentschieden}</td>
              <td className="zahl">{z.niederlagen}</td>
              <td className="zahl">
                {z.toreFuer}:{z.toreGegen}
              </td>
              <td className="zahl">
                <strong>{z.punkte}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Resultate({ spiele, teams, nurEigene = true }: { spiele: Spiel[]; teams: WettkampfTeam[]; nurEigene?: boolean }) {
  const n = (id: string) => teams.find((t) => t.id === id);
  const liste = spiele.filter((s) => !nurEigene || n(s.heimId)?.eigenesTeamId || n(s.gastId)?.eigenesTeamId).slice(-15).reverse();
  if (liste.length === 0) return <Leer>Noch keine Spiele.</Leer>;
  return (
    <ul className="resultate">
      {liste.map((s, i) => (
        <li key={i}>
          <span className="klein">W{s.woche}</span> {n(s.heimId)?.name} – {n(s.gastId)?.name}{' '}
          <strong>
            {s.toreHeim}:{s.toreGast}
          </strong>
          {s.nachVerlaengerung && ' n.V.'}
        </li>
      ))}
    </ul>
  );
}

function Kalender({ s }: { s: GameState }) {
  const k = saisonKalender(saisonJahr(s));
  const wk = s.wettkampf;
  return (
    <ol className="kalender">
      {k.map((w) => {
        const termine: string[] = [];
        if (wk.u9.turnierWochen.includes(w.woche)) termine.push('U9-Turnier');
        if (wk.ligen.U12.turnierWochen.includes(w.woche)) termine.push('U12-Turnier');
        if (wk.ligen.U15.turnierWochen.includes(w.woche)) termine.push('U15-Turnier');
        if (wk.ligen.U12.finalWoche === w.woche) termine.push('Finalturniere U12/U15');
        const runden = wk.u18.runden.filter((r) => r.woche === w.woche).length;
        if (runden > 0) termine.push(`U18 ${runden > 1 ? `${runden} Runden` : 'Runde'}`);
        if (wk.gestartet && w.woche >= wk.u18.playoffStartWoche && w.phase === 'playoffs') termine.push('Playoffs');
        return (
          <li key={w.woche} className={`kalender-woche phase-${w.phase} ${w.woche === s.woche ? 'aktuell' : ''} ${w.woche < s.woche ? 'vergangen' : ''}`} aria-current={w.woche === s.woche ? 'date' : undefined}>
            <span className="kalender-nr">W{w.woche}</span>
            <span className="kalender-datum">{datumText(w.montag)}</span>
            <span className="kalender-phase">{PHASEN_NAMEN[w.phase]}</span>
            <span className="kalender-termine">
              {w.ferien && <Badge ton="info">{w.ferien.name}</Badge>}
              {termine.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Wettkampf({ spiel }: { spiel: SpielApi }) {
  const s = spiel.stand!.state;
  const [reiter, setReiter] = useState<Reiter>('kalender');
  const wk = s.wettkampf;

  return (
    <div className="stapel">
      <div className="segment breit" role="tablist" aria-label="Wettkampf">
        {(['kalender', 'U9', 'U12', 'U15', 'U18'] as Reiter[]).map((r) => (
          <button key={r} role="tab" aria-selected={reiter === r} className={reiter === r ? 'aktiv' : ''} onClick={() => setReiter(r)}>
            {r === 'kalender' ? 'Kalender' : r}
          </button>
        ))}
      </div>
      {reiter !== 'kalender' && !wk.gestartet && (
        <Karte>
          <Leer>Die Meisterschaft beginnt Ende September. Dann werden Spielpläne und Tabellen erstellt.</Leer>
        </Karte>
      )}
      {reiter === 'kalender' && (
        <Karte titel={`Saison ${s.saison}: Juni ${saisonJahr(s)} bis Mai ${saisonJahr(s) + 1}`}>
          <Kalender s={s} />
        </Karte>
      )}
      {reiter === 'U9' && wk.gestartet && (
        <Karte titel="U9: Turniere ohne Rangliste">
          <p>Bei den Jüngsten zählen Spass, Einsatzzeit und Fairplay – Ranglisten gibt es keine.</p>
          <p className="klein">Turnierwochen: {wk.u9.turnierWochen.map((w) => `W${w}`).join(', ')}</p>
          <Resultate spiele={wk.u9.spiele} teams={wk.u9.teilnehmer} />
        </Karte>
      )}
      {(reiter === 'U12' || reiter === 'U15') && wk.gestartet && (
        <>
          <Karte titel={`${reiter}: Liga mit 8 Teams`} aktion={<span className="klein">Die ersten 6 spielen das Finalturnier (W{wk.ligen[reiter].finalWoche})</span>}>
            <Tabelle teams={wk.ligen[reiter].teams} spiele={wk.ligen[reiter].spiele.filter((x) => x.typ === 'liga')} markiere={6} />
            <p className="klein">Turnierwochen: {wk.ligen[reiter].turnierWochen.map((w) => `W${w}`).join(', ')}</p>
          </Karte>
          {wk.ligen[reiter].finalRangliste.length > 0 && (
            <Karte titel="Finalturnier">
              <ol>
                {wk.ligen[reiter].finalRangliste.map((id) => {
                  const t = wk.ligen[reiter].teams.find((x) => x.id === id)!;
                  return (
                    <li key={id} className={t.eigenesTeamId ? 'eigen' : ''}>
                      {t.name}
                    </li>
                  );
                })}
              </ol>
            </Karte>
          )}
          <Karte titel="Letzte Resultate">
            <Resultate spiele={wk.ligen[reiter].spiele} teams={wk.ligen[reiter].teams} />
          </Karte>
        </>
      )}
      {reiter === 'U18' && wk.gestartet && (
        <>
          <Karte titel="U18-Meisterschaft (Hin- und Rückrunde)" aktion={<span className="klein">Die ersten 8 spielen die Playoffs</span>}>
            <Tabelle teams={wk.u18.teams} spiele={wk.u18.spiele.filter((x) => x.typ === 'meisterschaft')} markiere={8} />
          </Karte>
          <Karte titel="Playoffs (best of 3)" aktion={wk.u18.meisterId ? <Badge ton="gut">Meister: {wk.u18.teams.find((t) => t.id === wk.u18.meisterId)?.name}</Badge> : aktuelleRunde(wk.u18) ? <Badge ton="info">{playoffRundeName(aktuelleRunde(wk.u18)!)}</Badge> : undefined}>
            {wk.u18.playoffs.length === 0 ? (
              <Leer>Die Playoffs beginnen Anfang März (W{wk.u18.playoffStartWoche}).</Leer>
            ) : (
              <div className="playoffs">
                {(['viertelfinal', 'halbfinal', 'final'] as const).map((runde) => {
                  const serien = wk.u18.playoffs.filter((x) => x.runde === runde);
                  if (serien.length === 0) return null;
                  return (
                    <div key={runde} className="playoff-runde">
                      <h3>{playoffRundeName(runde)}</h3>
                      {serien.map((serie, i) => {
                        const n = (id: string) => wk.u18.teams.find((t) => t.id === id);
                        const h = n(serie.hoehergesetztId)!;
                        const t = n(serie.tiefergesetztId)!;
                        return (
                          <div key={i} className="serie">
                            <div className={`${serie.siegerId === h.id ? 'sieger' : ''} ${h.eigenesTeamId ? 'eigen' : ''}`}>
                              {h.name} <strong>{serie.siegeHoeher}</strong>
                            </div>
                            <div className={`${serie.siegerId === t.id ? 'sieger' : ''} ${t.eigenesTeamId ? 'eigen' : ''}`}>
                              {t.name} <strong>{serie.siegeTiefer}</strong>
                            </div>
                            <div className="klein">{serie.spiele.map((sp) => `${sp.toreHeim}:${sp.toreGast}${sp.nachVerlaengerung ? ' n.V.' : ''}`).join(' · ')}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </Karte>
          <Karte titel="Letzte Resultate">
            <Resultate spiele={wk.u18.spiele} teams={wk.u18.teams} />
          </Karte>
        </>
      )}
    </div>
  );
}
