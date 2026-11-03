import { useState } from 'react';
import {
  B,
  ROLLEN_NAMEN,
  SKILL_NAMEN,
  SKILLS,
  STUFEN,
  aktiveTrainer,
  alter,
  berechneTeamWerte,
  name,
  stimmungAus,
  teamGruendenMoeglich,
  teamKinder,
  teamTrainer,
  teamsDerStufe,
  teamsVonTrainer,
  type GameState,
  type Schwerpunkt,
  type Team,
  type TrainerRolle
} from '../../engine';
import { Badge, Balken, Karte } from '../components/Basis';
import { Portrait } from '../components/Portrait';
import type { SpielApi } from '../useSpiel';

const SCHWERPUNKTE: { id: Schwerpunkt; name: string }[] = [
  { id: 'spass', name: 'Spass und Bewegung' },
  { id: 'spielformen', name: 'Spielformen' },
  { id: 'technik', name: 'Technik' },
  { id: 'kondition', name: 'Kondition' },
  { id: 'taktik', name: 'Taktik' }
];
const ROLLEN = Object.keys(ROLLEN_NAMEN) as TrainerRolle[];

function TeamKarte({ spiel, team, s }: { spiel: SpielApi; team: Team; s: GameState }) {
  const [neuerTrainer, setNeuerTrainer] = useState('');
  const [neueRolle, setNeueRolle] = useState<TrainerRolle>('cotrainer');
  const [kinderOffen, setKinderOffen] = useState(false);
  const kinder = teamKinder(s, team.id).sort((a, b) => a.geburtsjahr - b.geburtsjahr || a.nachname.localeCompare(b.nachname));
  const werte = berechneTeamWerte(s, team);
  const c = B.stufen[team.stufe];
  const verfuegbar = aktiveTrainer(s).filter((t) => !team.trainer.some((x) => x.trainerId === t.id));
  const geschwisterTeams = teamsDerStufe(s, team.stufe).filter((t) => t.id !== team.id);
  const z = kinder.length ? kinder.reduce((a, k) => a + k.zufriedenheit, 0) / kinder.length : 0;

  return (
    <Karte
      titel={
        <>
          {team.name} <span className="klein">({c.alterMin}–{c.alterMax} Jahre)</span>
        </>
      }
      aktion={
        geschwisterTeams.length > 0 && !s.wettkampf.gestartet ? (
          <button className="knopf klein" onClick={() => spiel.entscheiden({ typ: 'teamAufloesen', teamId: team.id })}>
            Team auflösen
          </button>
        ) : undefined
      }
    >
      <div className="team-raster">
        <div>
          <div className="zeile-info">
            <span>
              <strong>{kinder.length}</strong> Kinder (ideal {c.idealMin}–{c.idealMax})
            </span>
            {kinder.length > c.idealMax && <Badge ton="warn">zu gross</Badge>}
            {kinder.length < c.idealMin && <Badge ton="warn">klein</Badge>}
            {team.flags['einsatzregeln'] && <Badge ton="gut">Einsatzregeln transparent</Badge>}
          </div>
          <Balken label="Ø Zufriedenheit" wert={z} ton="auto" />
          <h3>Trainingsplan</h3>
          <div className="formular-zeile">
            <label>
              Trainings pro Woche
              <select
                value={team.plan.trainingsProWoche}
                onChange={(e) => spiel.entscheiden({ typ: 'trainingsplan', teamId: team.id, plan: { ...team.plan, trainingsProWoche: Number(e.target.value) } })}
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Schwerpunkt
              <select
                value={team.plan.schwerpunkt}
                onChange={(e) =>
                  spiel.entscheiden({ typ: 'trainingsplan', teamId: team.id, plan: { ...team.plan, schwerpunkt: e.target.value as Schwerpunkt } })
                }
              >
                {SCHWERPUNKTE.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="klein">
            Halle: {team.halle} · Hallenmiete CHF {B.finanzen.hallenmieteProTraining} pro Training
            {team.absagenSaison > 0 && ` · ${team.absagenSaison} Absagen diese Saison`}
          </p>
        </div>

        <div>
          <h3>Trainerteam ({werte.anzahlTrainer}/4)</h3>
          <div className="mix">
            {werte.generationenMix ? <Badge ton="gut">Generationen-Mix</Badge> : <Badge>kein Generationen-Mix</Badge>}
            {werte.geschlechterMix ? <Badge ton="gut">gemischtes Team</Badge> : <Badge>nicht gemischt</Badge>}
            {werte.konflikt > 0 && <Badge ton="schlecht">Konflikt</Badge>}
          </div>
          <ul className="trainerliste">
            {teamTrainer(s, team).map((t) => {
              const rolle = team.trainer.find((x) => x.trainerId === t.id)!.rolle;
              const anzahlTeams = teamsVonTrainer(s, t.id).length;
              return (
                <li key={t.id} className="trainer-zeile">
                  <Portrait meta={t.portrait} personId={t.id} vorname={t.vorname} nachname={t.nachname} groesse={40} />
                  <div className="trainer-info">
                    <strong>{name(t)}</strong>
                    <span className="klein">
                      {alter(s, t)} J. · Belastung {Math.round(t.belastung)}
                      {anzahlTeams > 1 && ` · ${anzahlTeams} Teams`}
                    </span>
                  </div>
                  <select
                    aria-label={`Rolle von ${name(t)}`}
                    value={rolle}
                    onChange={(e) => spiel.entscheiden({ typ: 'trainerZuteilen', trainerId: t.id, teamId: team.id, rolle: e.target.value as TrainerRolle })}
                  >
                    {ROLLEN.map((r) => (
                      <option key={r} value={r}>
                        {ROLLEN_NAMEN[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="knopf klein"
                    aria-label={`${name(t)} aus ${team.name} entfernen`}
                    onClick={() => spiel.entscheiden({ typ: 'trainerEntfernen', trainerId: t.id, teamId: team.id })}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          {werte.anzahlTrainer < 4 && verfuegbar.length > 0 && (
            <div className="formular-zeile">
              <label>
                Trainer:in hinzufügen
                <select value={neuerTrainer} onChange={(e) => setNeuerTrainer(e.target.value)}>
                  <option value="">– wählen –</option>
                  {verfuegbar.map((t) => (
                    <option key={t.id} value={t.id}>
                      {name(t)} ({alter(s, t)}, {teamsVonTrainer(s, t.id).length} Teams)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rolle
                <select value={neueRolle} onChange={(e) => setNeueRolle(e.target.value as TrainerRolle)}>
                  {ROLLEN.map((r) => (
                    <option key={r} value={r}>
                      {ROLLEN_NAMEN[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="knopf"
                disabled={!neuerTrainer}
                onClick={() => {
                  spiel.entscheiden({ typ: 'trainerZuteilen', trainerId: neuerTrainer, teamId: team.id, rolle: neueRolle });
                  setNeuerTrainer('');
                }}
              >
                Zuteilen
              </button>
            </div>
          )}
          <h3>Team-Werte</h3>
          {SKILLS.map((sk) => (
            <Balken key={sk} label={SKILL_NAMEN[sk]} wert={werte.skills[sk]} />
          ))}
        </div>
      </div>

      <button className="link" aria-expanded={kinderOffen} onClick={() => setKinderOffen(!kinderOffen)}>
        {kinderOffen ? 'Kinder ausblenden' : `Kinder anzeigen (${kinder.length})`}
      </button>
      {kinderOffen && (
        <ul className="kinderliste">
          {kinder.map((k) => (
            <li key={k.id} className="kind-zeile">
              <Portrait meta={k.portrait} personId={k.id} vorname={k.vorname} nachname={k.nachname} stimmung={stimmungAus(k.zufriedenheit)} groesse={36} />
              <span className="kind-name">
                {name(k)} <span className="klein">({alter(s, k)})</span>
                {k.status === 'schnupper' && <Badge ton="info">Schnupper</Badge>}
              </span>
              <span className="kind-z">Z {Math.round(k.zufriedenheit)}</span>
              {geschwisterTeams.length > 0 && (
                <select
                  aria-label={`${name(k)} verschieben`}
                  value={team.id}
                  onChange={(e) => spiel.entscheiden({ typ: 'kindVerschieben', kindId: k.id, teamId: e.target.value })}
                >
                  <option value={team.id}>{team.name}</option>
                  {geschwisterTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      → {t.name}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </Karte>
  );
}

export function Teams({ spiel }: { spiel: SpielApi }) {
  const s = spiel.ansicht!;
  return (
    <div className="stapel">
      {STUFEN.map((stufe) => {
        const teams = teamsDerStufe(s, stufe);
        const grund = teamGruendenMoeglich(s, stufe);
        return (
          <div key={stufe} className="stufe">
            <div className="stufe-kopf">
              <h2>{stufe}</h2>
              <div className="zeile">
                {teams.length > 1 && (
                  <button className="knopf klein" onClick={() => spiel.entscheiden({ typ: 'kinderAufteilen', stufe })}>
                    Kinder gleichmässig aufteilen
                  </button>
                )}
                <button
                  className="knopf klein"
                  disabled={!!grund}
                  title={grund ?? undefined}
                  onClick={() => spiel.entscheiden({ typ: 'teamGruenden', stufe })}
                >
                  + Team gründen
                </button>
              </div>
            </div>
            {teams.length === 0 && <p className="leer">Kein Team in dieser Stufe.</p>}
            {teams.map((t) => (
              <TeamKarte key={t.id} spiel={spiel} team={t} s={s} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
