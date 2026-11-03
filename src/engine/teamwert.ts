// Team-Werte aus dem Trainerteam: bester Wert plus Anteil der übrigen, Mix-Boni,
// abnehmender Nutzen bei Überbesetzung.
import { B, trainerZug } from './config';
import { alter } from './personen';
import type { GameState, Team, Trainer, TrainerRolle, TrainerSkill, TrainerSkills } from './types';
import { clamp } from './util';

export const SKILLS: readonly TrainerSkill[] = [
  'organisation',
  'kinderverstaendnis',
  'fachwissen',
  'erfahrung',
  'torhueter'
] as const;

export const ROLLEN_SKILLS: Record<TrainerRolle, TrainerSkill[]> = {
  haupttrainer: ['organisation', 'erfahrung'],
  cotrainer: ['fachwissen'],
  torhuetertrainer: ['torhueter'],
  betreuer: ['kinderverstaendnis']
};

export const ROLLEN_NAMEN: Record<TrainerRolle, string> = {
  haupttrainer: 'Haupttrainer:in',
  cotrainer: 'Co-Trainer:in',
  torhuetertrainer: 'Torhütertrainer:in',
  betreuer: 'Betreuer:in / Hilfsleiter:in'
};

export const SKILL_NAMEN: Record<TrainerSkill, string> = {
  organisation: 'Organisation',
  kinderverstaendnis: 'Kinderverständnis',
  fachwissen: 'Fachwissen aktuell',
  erfahrung: 'Erfahrung',
  torhueter: 'Torhüter-Fachwissen'
};

export interface TeamWerte {
  /** 0–100 pro Skill */
  skills: TrainerSkills;
  generationenMix: boolean;
  geschlechterMix: boolean;
  hatHaupttrainer: boolean;
  anzahlTrainer: number;
  /** durchschnittliche Belastung 0–100 */
  belastung: number;
  /** Summe der Spass-Boni aus Charakterzügen */
  spassBonus: number;
  /** Abzug durch Konflikte im Trainerteam (0–20) */
  konflikt: number;
}

/** Schwerpunkt einer Person = höchster Skill (ohne Torhüter, ausser bei Torhütertrainer:innen). */
export function schwerpunktVon(t: Trainer, rolle?: TrainerRolle): TrainerSkill {
  const kandidaten = rolle === 'torhuetertrainer' ? SKILLS : SKILLS.filter((s) => s !== 'torhueter');
  return kandidaten.reduce((best, s) => (t.skills[s] > t.skills[best] ? s : best));
}

function effektiverSkill(t: Trainer, rolle: TrainerRolle, skill: TrainerSkill): number {
  let v = t.skills[skill];
  for (const z of t.charakterzuege) {
    const def = trainerZug(z);
    if (!def) continue;
    if (skill === 'kinderverstaendnis' && def.kinderverstaendnis) v += def.kinderverstaendnis;
    if (skill === 'organisation' && def.organisation) v += def.organisation;
    if (skill === 'fachwissen' && def.fachwissen) v += def.fachwissen;
  }
  if (ROLLEN_SKILLS[rolle].includes(skill)) v *= B.teamwert.rollenBonus;
  return v;
}

export function berechneTeamWerte(state: GameState, team: Team): TeamWerte {
  const mitglieder = team.trainer
    .map((tt) => ({ t: state.trainer[tt.trainerId], rolle: tt.rolle }))
    .filter((x): x is { t: Trainer; rolle: TrainerRolle } => !!x.t && x.t.status === 'aktiv');

  const skills = {} as TrainerSkills;
  for (const skill of SKILLS) {
    const eintraege = mitglieder
      .map((m) => ({ v: effektiverSkill(m.t, m.rolle, skill), sp: schwerpunktVon(m.t, m.rolle) }))
      .sort((a, b) => b.v - a.v);
    let summe = 0;
    let gleicherSchwerpunkt = 0;
    eintraege.forEach((e, i) => {
      let gewicht = B.teamwert.gewichte[i] ?? 0;
      if (e.sp === skill) {
        gleicherSchwerpunkt++;
        if (gleicherSchwerpunkt > 2) gewicht *= B.teamwert.ueberbesetzungFaktor;
      }
      summe += gewicht * e.v;
    });
    skills[skill] = clamp((summe / B.teamwert.maxWert) * 100, 0, 100);
  }

  const hatHaupttrainer = mitglieder.some((m) => m.rolle === 'haupttrainer');
  if (!hatHaupttrainer && mitglieder.length > 0) {
    skills.organisation *= B.teamwert.ohneHaupttrainerAbzug;
  }

  const alterListe = mitglieder.map((m) => alter(state, m.t));
  const generationenMix = alterListe.some((a) => a > 40) && alterListe.some((a) => a < 26);
  const geschlechter = new Set(mitglieder.map((m) => m.t.geschlecht));
  const geschlechterMix = geschlechter.size > 1;

  let spassBonus = 0;
  for (const m of mitglieder) {
    for (const z of m.t.charakterzuege) spassBonus += trainerZug(z)?.spass ?? 0;
  }

  let konflikt = 0;
  for (const m of mitglieder) {
    for (const b of m.t.beziehungen) {
      if (b.staerke < 0 && mitglieder.some((x) => x.t.id === b.zielId)) konflikt += -b.staerke / 10;
    }
  }

  const belastung =
    mitglieder.length === 0 ? 0 : mitglieder.reduce((s, m) => s + m.t.belastung, 0) / mitglieder.length;

  return {
    skills,
    generationenMix,
    geschlechterMix,
    hatHaupttrainer,
    anzahlTrainer: mitglieder.length,
    belastung,
    spassBonus,
    konflikt: clamp(konflikt / 2, 0, 20)
  };
}
