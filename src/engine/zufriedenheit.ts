// Zufriedenheit: Zielwert aus gewichteten Faktoren, wöchentliche Annäherung.
import { B, elternTyp, kindZug } from './config';
import { beitragsFaktor, haertefallAktiv, stufeVonKind } from './finanzen';
import { teamKinder } from './personen';
import { berechneTeamWerte, type TeamWerte } from './teamwert';
import type { GameState, Kind, Team, TrainingsAnpassung, Zufriedenheitsfaktoren } from './types';
import { clamp } from './util';

export const FAKTOR_NAMEN: Record<keyof Zufriedenheitsfaktoren, string> = {
  trainerbeziehung: 'Trainerbeziehung',
  teamklima: 'Teamklima',
  spassEinsatz: 'Spass und Einsatzzeit',
  entwicklung: 'Entwicklung',
  elterneinfluss: 'Elterneinfluss',
  rahmen: 'Rahmen'
};

/** Wochenkontext eines Teams für die Berechnung */
export interface TeamKontext {
  team: Team;
  werte: TeamWerte;
  kinderAnzahl: number;
  /** Basis-Teamklima 0–100 (ohne individuelle Charakterzüge) */
  klima: number;
  /** tatsächlich durchgeführte Trainings dieser Woche */
  trainings: number;
  anpassung?: TrainingsAnpassung;
  /** true, wenn das Team beim Zusammenlegen das jüngere war */
  zusammengelegtJuenger?: boolean;
}

export function teamKlima(state: GameState, team: Team): number {
  const kinder = teamKinder(state, team.id);
  if (kinder.length === 0) return 60;
  const sozial = kinder.reduce((s, k) => s + k.werte.sozialverhalten, 0) / kinder.length;
  let beitrag = 0;
  for (const k of kinder) for (const z of k.charakterzuege) beitrag += kindZug(z)?.teamklima ?? 0;
  return clamp(sozial * 5 + (beitrag * 8) / kinder.length + 5, 0, 100);
}

export function teamKontext(state: GameState, team: Team, trainings?: number): TeamKontext {
  return {
    team,
    werte: berechneTeamWerte(state, team),
    kinderAnzahl: teamKinder(state, team.id).length,
    klima: teamKlima(state, team),
    trainings: trainings ?? team.plan.trainingsProWoche
  };
}

function zugFaktor(k: Kind, faktor: keyof Zufriedenheitsfaktoren): number {
  let summe = 0;
  for (const z of k.charakterzuege) {
    const def = kindZug(z);
    if (!def) continue;
    if (def.aufhebendesFlag && k.flags[def.aufhebendesFlag]) continue;
    summe += def.faktoren[faktor] ?? 0;
  }
  return summe;
}

function zugWert(k: Kind, feld: 'einsatzSensibel' | 'kinderverstaendnisSensibel' | 'negativFaktor' | 'siegSensibel'): number {
  let w = 1;
  for (const z of k.charakterzuege) {
    const v = kindZug(z)?.[feld];
    if (typeof v === 'number') w *= v;
  }
  return w;
}

export function negativFaktor(k: Kind): number {
  return zugWert(k, 'negativFaktor');
}
export function siegFaktor(k: Kind): number {
  return zugWert(k, 'siegSensibel');
}

/** Berechnet die Zielfaktoren (je 0–100) eines Kindes. */
export function zielFaktoren(state: GameState, k: Kind, ctx: TeamKontext | null): Zufriedenheitsfaktoren {
  const Z = B.zufriedenheit;
  const stufe = stufeVonKind(state, k) ?? 'U9';
  const jugend = stufe === 'U15' || stufe === 'U18';

  // Trainerbeziehung
  let trainerbeziehung: number = Z.ohneTrainer;
  if (ctx && ctx.werte.anzahlTrainer > 0) {
    const sens = zugWert(k, 'kinderverstaendnisSensibel');
    trainerbeziehung = 50 + (ctx.werte.skills.kinderverstaendnis - 50) * sens + 10;
    if (ctx.werte.generationenMix) trainerbeziehung += Z.generationenMixBonus;
    if (ctx.werte.geschlechterMix) {
      trainerbeziehung += Z.geschlechterMixBonus * (jugend ? Z.geschlechterMixFaktorJugend : 1);
    }
    if (ctx.werte.belastung > Z.belastungAbzugAb) {
      trainerbeziehung -= ((ctx.werte.belastung - Z.belastungAbzugAb) / (100 - Z.belastungAbzugAb)) * Z.belastungAbzugMax;
    }
    trainerbeziehung -= ctx.werte.konflikt;
  }
  trainerbeziehung += zugFaktor(k, 'trainerbeziehung');

  // Teamklima
  let teamklima = (ctx?.klima ?? 55) + zugFaktor(k, 'teamklima');
  if (ctx) teamklima -= ctx.werte.konflikt / 2;

  // Spass und Einsatzzeit
  let spassEinsatz = 60;
  if (ctx) {
    const sc = B.stufen[stufe];
    const tKey = String(clamp(Math.round(ctx.trainings), 0, 3)) as '0' | '1' | '2' | '3';
    const team = ctx.team;
    const trainingsZaehlen = ctx.anpassung !== 'absagen';
    if (trainingsZaehlen) spassEinsatz += B.training.spassProTraining[tKey];
    spassEinsatz += B.schwerpunkte[team.plan.schwerpunkt].spass[stufe];
    if (ctx.kinderAnzahl > sc.idealMax) spassEinsatz -= Z.zuGrossAbzugProKind * (ctx.kinderAnzahl - sc.idealMax);
    if (ctx.kinderAnzahl < sc.idealMin) spassEinsatz -= Z.zuKleinAbzugProKind * (sc.idealMin - ctx.kinderAnzahl);
    spassEinsatz += (k.einsatzzeit - 0.7) * 40 * zugWert(k, 'einsatzSensibel');
    if (team.absagenInFolge > 0) {
      spassEinsatz -= Z.absageAbzug * Math.pow(Z.absageAbzugFolgeFaktor, team.absagenInFolge - 1);
    }
    if (ctx.anpassung === 'kleingruppe') spassEinsatz += Z.kleingruppeBonus;
    if (ctx.zusammengelegtJuenger) spassEinsatz -= Z.zusammenlegenAbzugJuengere;
    spassEinsatz += ctx.werte.spassBonus;
  } else {
    spassEinsatz = 25;
  }
  spassEinsatz += zugFaktor(k, 'spassEinsatz');

  // Entwicklung
  let entwicklung = 35 + clamp(k.fortschritt, 0, 0.4) * 150;
  if (ctx) {
    entwicklung += (ctx.werte.skills.fachwissen - 50) * 0.3;
    if (ctx.werte.generationenMix) entwicklung += Z.generationenMixBonus / 2;
  }
  entwicklung += zugFaktor(k, 'entwicklung');

  // Elterneinfluss
  const familie = state.familien[k.familieId];
  const eltern = (familie?.elternIds ?? []).map((id) => state.eltern[id]).filter((e) => !!e);
  let elterneinfluss = 60;
  if (eltern.length > 0) {
    elterneinfluss =
      eltern.reduce((s, e) => {
        const def = elternTyp(e!.typ);
        let basis = def.basis;
        if (def.einsatzAbhaengig) basis += def.einsatzAbhaengig * (k.einsatzzeit - 0.5) * 2;
        return s + 0.5 * basis + 0.5 * e!.stimmung;
      }, 0) / eltern.length;
  }
  elterneinfluss += zugFaktor(k, 'elterneinfluss');

  // Rahmen: Material und Beitrag im Verhältnis zur Familie
  let rahmen: number = B.finanzen.materialRahmen[state.finanzen.material];
  if (familie) {
    const ef = familie.einkommen === 'tief' ? 2 : familie.einkommen === 'mittel' ? 1 : 0.4;
    const reduziert = haertefallAktiv(state, familie);
    const f = beitragsFaktor(state, stufe) * (reduziert ? 1 - B.finanzen.haertefallRabatt : 1);
    rahmen -= 12 * (f - 1) * ef + (familie.einkommen === 'tief' && !reduziert ? 6 : 0);
  }
  rahmen += zugFaktor(k, 'rahmen');

  return {
    trainerbeziehung: clamp(trainerbeziehung, 0, 100),
    teamklima: clamp(teamklima, 0, 100),
    spassEinsatz: clamp(spassEinsatz, 0, 100),
    entwicklung: clamp(entwicklung, 0, 100),
    elterneinfluss: clamp(elterneinfluss, 0, 100),
    rahmen: clamp(rahmen, 0, 100)
  };
}

/** Gewichteter Zielwert aus den Faktoren */
export function zielwert(f: Zufriedenheitsfaktoren): number {
  const g = B.zufriedenheit.gewichte;
  return (
    f.trainerbeziehung * g.trainerbeziehung +
    f.teamklima * g.teamklima +
    f.spassEinsatz * g.spassEinsatz +
    f.entwicklung * g.entwicklung +
    f.elterneinfluss * g.elterneinfluss +
    f.rahmen * g.rahmen
  );
}

/** Z_neu = Z_alt + 0.2 × (Z_ziel − Z_alt) + E, begrenzt auf 0–100 */
export function naechsteZufriedenheit(zAlt: number, zZiel: number, effekte: number): number {
  return clamp(zAlt + B.zufriedenheit.annaeherung * (zZiel - zAlt) + effekte, 0, 100);
}
