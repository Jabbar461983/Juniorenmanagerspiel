// Personen-Generator: Kinder, Eltern, Familien und Trainer:innen.
import {
  B,
  ELTERN_TYPEN,
  ELTERN_ZUEGE,
  HERKUENFTE,
  KIND_ZUEGE,
  TRAINER_ZUEGE,
  type HerkunftDef
} from './config';
import { alter, portraitGruppe } from './personen';
import type { Rng } from './rng';
import type {
  Elternteil,
  Familie,
  GameState,
  Geschlecht,
  Hautton,
  Kind,
  Qualifikation,
  Trainer,
  TrainerSkills
} from './types';
import { clamp, neueId } from './util';

function wert(rng: Rng, mittel: number, streuung = 3): number {
  return clamp(Math.round(rng.normal(mittel, streuung)), 1, 20);
}

function herkunftWaehlen(rng: Rng): HerkunftDef {
  return rng.weighted(HERKUENFTE, (h) => h.gewicht);
}

function hautton(rng: Rng, h: HerkunftDef): Hautton {
  const eintraege = Object.entries(h.hautton);
  return rng.weighted(eintraege, ([, g]) => g)[0] as Hautton;
}

function vorname(rng: Rng, h: HerkunftDef, g: Geschlecht): string {
  return rng.pick(g === 'w' ? h.w : h.m);
}

function zuege(rng: Rng, pool: { id: string }[], min = 1, max = 2): string[] {
  const anzahl = rng.int(min, max);
  return rng.shuffle(pool.map((z) => z.id)).slice(0, anzahl);
}

export interface FamilieOptionen {
  herkunft?: HerkunftDef;
  nachname?: string;
}

/** Erzeugt eine Familie mit 1–2 Elternteilen (ohne Kinder). */
export function erzeugeFamilie(state: GameState, rng: Rng, opt: FamilieOptionen = {}): Familie {
  const h = opt.herkunft ?? herkunftWaehlen(rng);
  const nachname = opt.nachname ?? rng.pick(h.nachnamen);
  const ein = B.start.einkommen;
  const einkommen = rng.weighted(['tief', 'mittel', 'hoch'] as const, (e) => ein[e]);
  const familie: Familie = {
    id: neueId(state, 'f'),
    nachname,
    einkommen,
    kinderIds: [],
    elternIds: [],
    haertefall: false
  };
  state.familien[familie.id] = familie;
  const famTon = hautton(rng, h);
  const anzahlEltern = rng.chance(B.start.zweiElternWahrscheinlichkeit) ? 2 : 1;
  const ersteG: Geschlecht = rng.chance(0.55) ? 'w' : 'm';
  for (let i = 0; i < anzahlEltern; i++) {
    const g: Geschlecht = i === 0 ? ersteG : ersteG === 'w' ? 'm' : 'w';
    const typ = rng.weighted(ELTERN_TYPEN, (t) => t.gewicht).id;
    const geburtsjahr = state.startJahr + state.saison - 1 - rng.int(30, 52);
    const e: Elternteil = {
      id: neueId(state, 'e'),
      rolle: 'elternteil',
      vorname: vorname(rng, h, g),
      nachname,
      geschlecht: g,
      geburtsjahr,
      herkunft: h.id,
      portrait: { gruppe: 'erwachsen', geschlecht: g, hautton: famTon, nummer: 0 },
      charakterzuege: zuege(rng, ELTERN_ZUEGE, 1, 1),
      beziehungen: [],
      typ,
      engagement: wert(rng, typ === 'engagiert' || typ === 'potenziellerTrainer' ? 14 : typ === 'abwesend' ? 5 : 10),
      konfliktbereitschaft: wert(rng, typ === 'kritiker' || typ === 'ehrgeizig' ? 14 : 8),
      zahlungsmoral: wert(rng, einkommen === 'tief' ? 10 : 15),
      einfluss: wert(rng, typ === 'sponsor' ? 15 : 8),
      stimmung: rng.int(55, 80),
      familieId: familie.id
    };
    e.portrait.gruppe = portraitGruppe(alter(state, e));
    state.eltern[e.id] = e;
    familie.elternIds.push(e.id);
  }
  // Partner kennen sich
  if (familie.elternIds.length === 2) {
    const [a, b] = familie.elternIds as [string, string];
    state.eltern[a]!.beziehungen.push({ zielId: b, art: 'familie', staerke: 70 });
    state.eltern[b]!.beziehungen.push({ zielId: a, art: 'familie', staerke: 70 });
  }
  return familie;
}

export interface KindOptionen {
  alter: number;
  talentBereich?: [number, number];
  status?: Kind['status'];
  zufriedenheit?: number;
}

/** Erzeugt ein Kind in einer bestehenden Familie. */
export function erzeugeKind(state: GameState, rng: Rng, familie: Familie, opt: KindOptionen): Kind {
  const ersterElternteil = state.eltern[familie.elternIds[0] ?? ''];
  const herkunftId = ersterElternteil?.herkunft ?? 'schweiz';
  const h = HERKUENFTE.find((x) => x.id === herkunftId) ?? herkunftWaehlen(rng);
  const g: Geschlecht = rng.chance(0.4) ? 'w' : 'm';
  const a = opt.alter;
  const talent = opt.talentBereich ? rng.int(opt.talentBereich[0], opt.talentBereich[1]) : wert(rng, 10, 4);
  // Grundniveau steigt mit dem Alter, Talent hebt es an
  const basis = 2.5 + (a - 6) * 0.8 + (talent - 10) * 0.25;
  const zuegeIds = zuege(rng, KIND_ZUEGE);
  // Neuzuzug mit Sprachproblemen nur bei Familien mit Migrationshintergrund plausibel
  const gefiltert = zuegeIds.filter((z) => z !== 'neuzuzug_sprache' || (h.id !== 'schweiz' && h.id !== 'romandie'));
  const k: Kind = {
    id: neueId(state, 'k'),
    rolle: 'kind',
    vorname: vorname(rng, h, g),
    nachname: familie.nachname,
    geschlecht: g,
    geburtsjahr: state.startJahr + state.saison - 1 - a,
    herkunft: h.id,
    portrait: {
      gruppe: portraitGruppe(a),
      geschlecht: g,
      hautton: ersterElternteil?.portrait.hautton ?? hautton(rng, h),
      nummer: 0
    },
    charakterzuege: gefiltert.length > 0 ? gefiltert : ['teamplayer'],
    beziehungen: [],
    werte: {
      talent,
      technik: wert(rng, basis, 2),
      kondition: wert(rng, basis, 2),
      spielverstaendnis: wert(rng, basis - 0.5, 2),
      motivation: wert(rng, 13, 3),
      sozialverhalten: wert(rng, 12, 3.5),
      selbstvertrauen: wert(rng, 11, 3.5),
      fairplay: wert(rng, 12, 3.5)
    },
    zufriedenheit: opt.zufriedenheit ?? rng.int(B.start.zufriedenheitStart[0]!, B.start.zufriedenheitStart[1]!),
    faktoren: {
      trainerbeziehung: 60,
      teamklima: 60,
      spassEinsatz: 60,
      entwicklung: 60,
      elterneinfluss: 60,
      rahmen: 60
    },
    offeneEffekte: 0,
    austrittsRisikoZusatz: 0,
    teamId: null,
    familieId: familie.id,
    status: opt.status ?? 'aktiv',
    schnupperWochenRest: opt.status === 'schnupper' ? B.eintritt.schnupperWochen : 0,
    einsatzzeit: 0.7,
    fortschritt: 0.1,
    eintritt: { saison: state.saison, woche: state.woche },
    flags: {}
  };
  // Geschwister-Beziehungen
  for (const gid of familie.kinderIds) {
    const g2 = state.kinder[gid];
    if (!g2) continue;
    g2.beziehungen.push({ zielId: k.id, art: 'familie', staerke: 60 });
    k.beziehungen.push({ zielId: gid, art: 'familie', staerke: 60 });
  }
  for (const eid of familie.elternIds) {
    k.beziehungen.push({ zielId: eid, art: 'familie', staerke: 80 });
  }
  familie.kinderIds.push(k.id);
  state.kinder[k.id] = k;
  return k;
}

/** Neues Kind samt neuer Familie (evtl. mit Geschwister). */
export function erzeugeKindMitFamilie(state: GameState, rng: Rng, opt: KindOptionen): Kind {
  const familie = erzeugeFamilie(state, rng);
  return erzeugeKind(state, rng, familie, opt);
}

/**
 * Trainer-Startwerte nach Altersprofil: Ältere (über 45) stark bei Organisation und
 * Erfahrung, Jüngere (16–25) bei Kinderverständnis und aktuellem Fachwissen.
 */
export function trainerSkillsFuerAlter(rng: Rng, a: number): TrainerSkills {
  let org = 10;
  let kind = 10;
  let fach = 10;
  let erf = 10;
  if (a > 45) {
    org = 13;
    erf = 14;
    kind = 8;
    fach = 7;
  } else if (a <= 25) {
    org = 7;
    erf = 5;
    kind = 13;
    fach = 13;
  }
  return {
    organisation: wert(rng, org, 3),
    kinderverstaendnis: wert(rng, kind, 3),
    fachwissen: wert(rng, fach, 3),
    erfahrung: wert(rng, erf, 3),
    torhueter: wert(rng, 6, 4)
  };
}

export interface TrainerOptionen {
  alter?: number;
  quelle?: Trainer['quelle'];
  geschlecht?: Geschlecht;
}

export function erzeugeTrainer(state: GameState, rng: Rng, opt: TrainerOptionen = {}): Trainer {
  const h = herkunftWaehlen(rng);
  const g: Geschlecht = opt.geschlecht ?? (rng.chance(0.4) ? 'w' : 'm');
  // Altersverteilung 16–75: viele 18–30 und 35–55
  const a = opt.alter ?? clamp(Math.round(rng.chance(0.4) ? rng.normal(23, 4) : rng.normal(45, 11)), 16, 75);
  const skills = trainerSkillsFuerAlter(rng, a);
  const quali: Qualifikation =
    a < 18
      ? 'keine'
      : rng.weighted(['keine', 'leiter', 'leiterWeiterbildung', 'experte'] as const, (q) =>
          q === 'keine' ? 3 : q === 'leiter' ? 5 : q === 'leiterWeiterbildung' ? 2 : a > 35 ? 0.5 : 0.1
        );
  const quelle =
    opt.quelle ??
    (a < 20 ? 'junior' : rng.weighted(['eltern', 'ehemalig', 'aktiv', 'inserat'] as const, (q) => (q === 'eltern' ? 4 : q === 'inserat' ? 1 : 2)));
  const t: Trainer = {
    id: neueId(state, 't'),
    rolle: 'trainer',
    vorname: vorname(rng, h, g),
    nachname: rng.pick(h.nachnamen),
    geschlecht: g,
    geburtsjahr: state.startJahr + state.saison - 1 - a,
    herkunft: h.id,
    portrait: { gruppe: portraitGruppe(a), geschlecht: g, hautton: hautton(rng, h), nummer: 0 },
    charakterzuege: zuege(rng, TRAINER_ZUEGE),
    beziehungen: [],
    skills,
    verfuegbarkeit: rng.weighted([1, 2, 3], (v) => (v === 2 ? 5 : v === 1 ? 2 : 2)),
    belastung: rng.int(10, 35),
    motivation: wert(rng, 14, 3),
    qualifikation: quali,
    quelle,
    status: 'aktiv',
    absagenSaison: 0
  };
  state.trainer[t.id] = t;
  return t;
}

/** Macht aus einem Elternteil eine Trainer:in (Betreuer:in). */
export function trainerAusElternteil(state: GameState, rng: Rng, e: Elternteil): Trainer {
  const a = alter(state, e);
  const t: Trainer = {
    id: neueId(state, 't'),
    rolle: 'trainer',
    vorname: e.vorname,
    nachname: e.nachname,
    geschlecht: e.geschlecht,
    geburtsjahr: e.geburtsjahr,
    herkunft: e.herkunft,
    portrait: { ...e.portrait },
    charakterzuege: zuege(rng, TRAINER_ZUEGE, 1, 1),
    beziehungen: [],
    skills: trainerSkillsFuerAlter(rng, a),
    verfuegbarkeit: 1,
    belastung: 15,
    motivation: 15,
    qualifikation: 'keine',
    quelle: 'eltern',
    status: 'aktiv',
    elternteilId: e.id,
    absagenSaison: 0
  };
  state.trainer[t.id] = t;
  return t;
}
