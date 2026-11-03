import {
  ANWERBUNG,
  B,
  optionText,
  type Entscheid,
  aktiveKinder,
  aktiveTrainer,
  chf,
  durchschnittZufriedenheit,
  hatWettkampf,
  offenePflichtEreignisse,
  teamKinder,
  teamTrainer,
  teamsVonTrainer,
  type GameState
} from '../../engine';
import type { Ansicht } from '../App';
import { Badge, Balken, Karte, Kennzahl } from '../components/Basis';
import type { SpielApi } from '../useSpiel';

function hinweise(s: GameState): { text: string; ziel: Ansicht }[] {
  const res: { text: string; ziel: Ansicht }[] = [];
  for (const team of Object.values(s.teams)) {
    const n = teamKinder(s, team.id).length;
    const c = B.stufen[team.stufe];
    if (teamTrainer(s, team).length === 0) res.push({ text: `${team.name} hat keine Trainer:in.`, ziel: 'teams' });
    else if (!team.trainer.some((t) => t.rolle === 'haupttrainer')) res.push({ text: `${team.name} hat keine Haupttrainer:in.`, ziel: 'teams' });
    if (n > c.idealMax) res.push({ text: `${team.name} ist mit ${n} Kindern zu gross (ideal ${c.idealMin}–${c.idealMax}). Ein zweites Team?`, ziel: 'teams' });
    if (n > 0 && n < c.idealMin) res.push({ text: `${team.name} ist mit ${n} Kindern klein (ideal ${c.idealMin}–${c.idealMax}).`, ziel: 'teams' });
    if (team.absagenInFolge >= 2) res.push({ text: `${team.name}: ${team.absagenInFolge} Absagen in Folge drücken die Stimmung.`, ziel: 'teams' });
  }
  for (const t of aktiveTrainer(s)) {
    if (t.belastung >= 75) res.push({ text: `${t.vorname} ${t.nachname} ist stark belastet (${Math.round(t.belastung)}).`, ziel: 'personen' });
    if (teamsVonTrainer(s, t.id).length === 0) res.push({ text: `${t.vorname} ${t.nachname} ist keinem Team zugeteilt.`, ziel: 'teams' });
  }
  if (s.finanzen.kasse < 0) res.push({ text: 'Die Kasse ist im Minus.', ziel: 'finanzen' });
  return res;
}

export function Uebersicht({ spiel, navigiere }: { spiel: SpielApi; navigiere: (a: Ansicht) => void }) {
  const s = spiel.ansicht!;
  const kinder = aktiveKinder(s);
  const schnupper = Object.values(s.kinder).filter((k) => k.status === 'schnupper').length;
  const z = durchschnittZufriedenheit(s);
  const pflicht = offenePflichtEreignisse(s).length;
  const h = hinweise(s);
  const letzteBilanz = s.bilanzen[s.bilanzen.length - 1];

  return (
    <div className="stapel">
      {s.spielende && (
        <Karte titel="Spielende" className="hervorgehoben">
          <p className="gross-text">
            {s.spielende.punkte} Punkte – «{s.spielende.titel}»
          </p>
          <p>{s.spielende.text}</p>
          {letzteBilanz && (
            <ul>
              {letzteBilanz.wettkampf.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <button className="knopf" onClick={spiel.schliessen}>
            Zum Startbildschirm
          </button>
        </Karte>
      )}
      <div className="kennzahlen">
        <Kennzahl label="Aktive Junior:innen" wert={kinder.length} zusatz={schnupper > 0 ? `+ ${schnupper} am Schnuppern` : undefined} />
        <Kennzahl label="Ø Zufriedenheit" wert={z.toFixed(1)} ton={z > 66 ? 'gut' : z >= 34 ? 'warn' : 'schlecht'} />
        <Kennzahl label="Kasse" wert={chf(s.finanzen.kasse)} ton={s.finanzen.kasse < 0 ? 'schlecht' : undefined} />
        <Kennzahl label="Trainer:innen" wert={aktiveTrainer(s).length} />
        <Kennzahl label="Offene Pflicht-Ereignisse" wert={pflicht} ton={pflicht > 0 ? 'warn' : 'gut'} />
      </div>

      <Karte titel="Teams" aktion={<button className="link" onClick={() => navigiere('teams')}>Teams bearbeiten</button>}>
        <div className="tabelle-huelle">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Kinder</th>
                <th scope="col">Zufriedenheit</th>
                <th scope="col">Trainer</th>
                <th scope="col">Training</th>
                <th scope="col">Diese Woche</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(s.teams).map((t) => {
                const tk = teamKinder(s, t.id);
                const tz = tk.length ? tk.reduce((a, k) => a + k.zufriedenheit, 0) / tk.length : 0;
                return (
                  <tr key={t.id}>
                    <th scope="row">{t.name}</th>
                    <td>{tk.length}</td>
                    <td className="zelle-balken">
                      <Balken wert={tz} ton="auto" />
                    </td>
                    <td>{teamTrainer(s, t).length}</td>
                    <td>
                      {t.plan.trainingsProWoche}× {t.plan.schwerpunkt}
                    </td>
                    <td>{hatWettkampf(s, t, s.woche) ? <Badge ton="info">Wettkampf</Badge> : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Karte>

      <Karte titel="Hinweise">
        {h.length === 0 ? (
          <p className="leer">Alles im grünen Bereich.</p>
        ) : (
          <ul className="hinweisliste">
            {h.map((x, i) => (
              <li key={i}>
                <button className="link" onClick={() => navigiere(x.ziel)}>
                  {x.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Karte>

      {spiel.stand!.entwurf.length > 0 && (
        <Karte titel="Geplante Entscheide dieser Woche">
          <ul className="liste">
            {spiel.stand!.entwurf.map((e, i) => (
              <li key={i} className="liste-zeile">
                <span>{entscheidText(s, e)}</span>
                <button className="knopf klein" onClick={() => spiel.entfernen(i)} aria-label="Entscheid entfernen">
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </Karte>
      )}
    </div>
  );
}

export function entscheidText(s: GameState, e: Entscheid): string {
  const team = (id: string) => s.teams[id]?.name ?? 'Team';
  const trainer = (id: string) => {
    const t = s.trainer[id];
    return t ? `${t.vorname} ${t.nachname}` : 'Trainer:in';
  };
  switch (e.typ) {
    case 'trainerZuteilen':
      return `${trainer(e.trainerId)} → ${team(e.teamId)} (${e.rolle})`;
    case 'trainerEntfernen':
      return `${trainer(e.trainerId)} aus ${team(e.teamId)} entfernen`;
    case 'trainingsplan':
      return `Trainingsplan ${team(e.teamId)}: ${e.plan.trainingsProWoche}× ${e.plan.schwerpunkt}`;
    case 'kindVerschieben': {
      const k = s.kinder[e.kindId];
      return `${k?.vorname ?? 'Kind'} → ${team(e.teamId)}`;
    }
    case 'teamGruenden':
      return `Neues Team ${e.stufe} gründen`;
    case 'teamAufloesen':
      return `${team(e.teamId)} auflösen`;
    case 'kinderAufteilen':
      return `Kinder der ${e.stufe} gleichmässig aufteilen`;
    case 'anwerbung':
      return `Anwerbung: ${ANWERBUNG.find((m) => m.id === e.massnahmeId)?.name ?? e.massnahmeId}${e.zielStufe ? ` (${e.zielStufe})` : ''}`;
    case 'beitrag':
      return `Beitrag ${e.stufe}: CHF ${e.betrag}`;
    case 'geschwisterrabatt':
      return `Geschwisterrabatt ${e.prozent} %`;
    case 'haertefallfonds':
      return `Härtefallfonds ${e.aktiv ? 'ein' : 'aus'}`;
    case 'material':
      return `Material: ${e.niveau}`;
    case 'entschaedigung':
      return `Trainerentschädigung: ${e.niveau}`;
    case 'ereignis': {
      const inst = s.ereignisse.find((x) => x.id === e.ereignisId);
      return inst ? `${inst.titel}: ${optionText(s, inst, e.optionId)}` : 'Ereignis';
    }
  }
}
