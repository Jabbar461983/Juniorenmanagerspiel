// Dialogsystem (Etappe 2).
//
// Ein Dialog wird als Liste gewählter Antwort-Ids gespeichert (Entscheid 'dialog').
// `dialogAuswerten` spielt diese Liste ohne Zufall durch und liefert Verlauf,
// Vertrauen, offenbarte Infos und gesammelte Effekte. Dieselbe Funktion nutzt die
// Oberfläche für die Anzeige und der Spielkern für die Anwendung – so bleibt alles
// reproduzierbar.
//
// Bedingungen (DialogBedingung.typ): vertrauenAb, vertrauenUnter, bekannt, nichtBekannt,
//   elternTyp, einkommen, hatTeam, teamPlatz, keinTrainer, helfer, keinHelfer, bereitschaftAb,
//   ausstand, erfahrungAb, haupttrainer, belastungAb, teamFlag, nichtTeamFlag,
//   Etappe 3: amt, prioritaet, haltungAb, haltungUnter, einflussAb, kasseUnter
import { B, DIALOGE, dialogDef, type AntwortDef, type DialogBedingung, type DialogDef, type Effekt, type KnotenDef } from './config';
import { ersetzePlatzhalter } from './ereignisse';
import { absoluteWoche } from './kalender';
import { teamsVonTrainer } from './personen';
import type { Beteiligte, Elternteil, GameState, Id, Person, Ton } from './types';
import { clamp } from './util';

export function personVon(state: GameState, id: Id): Person | undefined {
  return state.kinder[id] ?? state.eltern[id] ?? state.trainer[id] ?? state.vorstand.mitglieder[id];
}

/** Bereitschaft eines Elternteils, als Helfer:in mitzuwirken (ca. 0–25). */
export function helferBereitschaft(e: Elternteil): number {
  let b = e.engagement + e.vertrauen / 10 - e.auslastung / 10;
  if (e.typ === 'engagiert' || e.typ === 'potenziellerTrainer') b += 4;
  if (e.typ === 'abwesend') b -= 8;
  return b;
}

/** Vertrauensänderung durch den Ton, abhängig von Elterntyp und Charakterzügen. */
export function tonWirkung(p: Person, ton: Ton): number {
  const D = B.dialog;
  let w = D.ton[ton];
  if (p.rolle === 'elternteil') {
    const mod = (D.elternTyp as Record<string, Partial<Record<Ton, number>>>)[p.typ];
    w += mod?.[ton] ?? 0;
    if (p.konfliktbereitschaft >= D.konfliktbereitAb && ton === 'bestimmt') w += D.konfliktbereitBestimmt;
  }
  if (p.rolle === 'kind') {
    for (const z of p.charakterzuege) {
      const mod = (D.kindZug as Record<string, Partial<Record<Ton, number>>>)[z];
      w += mod?.[ton] ?? 0;
    }
  }
  if (p.rolle === 'vorstand') {
    const mod = (D.vorstandPrioritaet as Record<string, Partial<Record<Ton, number>>>)[p.prioritaet];
    w += mod?.[ton] ?? 0;
  }
  return w;
}

/** Standard-Beteiligte eines Dialogs aus der Person ableiten. */
export function dialogBeteiligte(state: GameState, dialog: DialogDef, personId: Id, basis: Beteiligte = {}): Beteiligte {
  const b: Beteiligte = { ...basis, [dialog.art]: personId };
  const p = personVon(state, personId);
  if (!p) return b;
  if (p.rolle === 'elternteil') {
    const f = state.familien[p.familieId];
    const kind = (f?.kinderIds ?? []).map((id) => state.kinder[id]).find((k) => k && k.status !== 'ausgetreten' && k.teamId);
    if (kind && !b['kind']) b['kind'] = kind.id;
    if (kind?.teamId && !b['team']) b['team'] = kind.teamId;
  } else if (p.rolle === 'kind') {
    if (p.teamId && !b['team']) b['team'] = p.teamId;
    const eltern = state.familien[p.familieId]?.elternIds[0];
    if (eltern && !b['elternteil']) b['elternteil'] = eltern;
  } else if (p.rolle === 'trainer') {
    const teams = teamsVonTrainer(state, p.id);
    const haupt = teams.find((t) => t.trainer.some((x) => x.trainerId === p.id && x.rolle === 'haupttrainer')) ?? teams[0];
    if (haupt && !b['team']) b['team'] = haupt.id;
  }
  return b;
}

export function bedingungErfuellt(state: GameState, p: Person, b: Beteiligte, vertrauen: number, c: DialogBedingung): boolean {
  const team = state.teams[b['team'] ?? ''];
  switch (c.typ) {
    case 'vertrauenAb':
      return vertrauen >= Number(c.wert);
    case 'vertrauenUnter':
      return vertrauen < Number(c.wert);
    case 'bekannt':
      return p.bekannt.includes(String(c.wert));
    case 'nichtBekannt':
      return !p.bekannt.includes(String(c.wert));
    case 'elternTyp':
      return p.rolle === 'elternteil' && p.typ === c.wert;
    case 'einkommen': {
      const famId = p.rolle === 'kind' || p.rolle === 'elternteil' ? p.familieId : undefined;
      return !!famId && state.familien[famId]?.einkommen === c.wert;
    }
    case 'amt':
      return p.rolle === 'vorstand' && p.amt === c.wert;
    case 'prioritaet':
      return p.rolle === 'vorstand' && p.prioritaet === c.wert;
    case 'haltungAb':
      return p.rolle === 'vorstand' && p.haltung >= Number(c.wert);
    case 'haltungUnter':
      return p.rolle === 'vorstand' && p.haltung < Number(c.wert);
    case 'einflussAb':
      return state.verein.vorstandEinfluss >= Number(c.wert);
    case 'kasseUnter':
      return state.finanzen.kasse < Number(c.wert);
    case 'hatTeam':
      return !!team;
    case 'teamPlatz':
      return !!team && team.trainer.length < B.trainer.maxTeamgroesse;
    case 'keinTrainer':
      return p.rolle === 'elternteil' && !Object.values(state.trainer).some((t) => t.elternteilId === p.id && t.status === 'aktiv');
    case 'helfer':
      return p.rolle === 'elternteil' && p.helfer !== null;
    case 'keinHelfer':
      return p.rolle === 'elternteil' && p.helfer === null;
    case 'bereitschaftAb':
      return p.rolle === 'elternteil' && helferBereitschaft({ ...p, vertrauen }) >= Number(c.wert);
    case 'ausstand':
      return p.rolle === 'elternteil' && (state.familien[p.familieId]?.ausstand ?? 0) > 0;
    case 'erfahrungAb':
      return p.rolle === 'trainer' && p.skills.erfahrung >= Number(c.wert);
    case 'haupttrainer':
      return p.rolle === 'trainer' && !!team && team.trainer.some((x) => x.trainerId === p.id && x.rolle === 'haupttrainer');
    case 'belastungAb':
      return p.rolle === 'trainer' && p.belastung >= Number(c.wert);
    case 'teamFlag':
      return !!team && !!team.flags[String(c.wert)];
    case 'nichtTeamFlag':
      return !!team && !team.flags[String(c.wert)];
  }
  return false;
}

export interface VerlaufSchritt {
  frage: string;
  antwort: string;
  ton: Ton;
  vertrauensAenderung: number;
}

export interface AntwortAnzeige {
  id: string;
  text: string;
  ton: Ton;
  moeglich: boolean;
}

export interface DialogZustand {
  dialog: DialogDef;
  personId: Id;
  beteiligte: Beteiligte;
  verlauf: VerlaufSchritt[];
  /** aktueller Knoten (null, wenn beendet) */
  frage: string | null;
  antworten: AntwortAnzeige[];
  vertrauenStart: number;
  vertrauen: number;
  offenbart: string[];
  effekte: Effekt[];
  beendet: boolean;
  endText: string | null;
  fehler: string | null;
}

function text(state: GameState, t: string, b: Beteiligte): string {
  return ersetzePlatzhalter(state, t, b, {});
}

function antwortMoeglich(state: GameState, p: Person, b: Beteiligte, v: number, a: AntwortDef): boolean {
  return (a.bedingung ?? []).every((c) => bedingungErfuellt(state, p, b, v, c));
}

/** Spielt einen Dialog mit den gewählten Antworten durch (rein, ohne Zufall). */
export function dialogAuswerten(
  state: GameState,
  dialogId: string,
  personId: Id,
  antworten: string[],
  basisBeteiligte: Beteiligte = {}
): DialogZustand {
  const dialog = dialogDef(dialogId);
  const p = personVon(state, personId);
  const b = dialogBeteiligte(state, dialog, personId, basisBeteiligte);
  const z: DialogZustand = {
    dialog,
    personId,
    beteiligte: b,
    verlauf: [],
    frage: null,
    antworten: [],
    vertrauenStart: p?.vertrauen ?? 0,
    vertrauen: p?.vertrauen ?? 0,
    offenbart: [],
    effekte: [],
    beendet: false,
    endText: null,
    fehler: null
  };
  if (!p) {
    z.fehler = 'Person nicht gefunden.';
    return z;
  }
  let knoten: KnotenDef | undefined = dialog.knoten[dialog.start];
  for (const aid of antworten) {
    if (!knoten) {
      z.fehler = 'Dialog ist bereits beendet.';
      return z;
    }
    const a = knoten.antworten.find((x) => x.id === aid);
    if (!a || !antwortMoeglich(state, p, b, z.vertrauen, a)) {
      z.fehler = `Antwort ${aid} ist hier nicht möglich.`;
      return z;
    }
    const delta = tonWirkung(p, a.ton) + (a.vertrauen ?? 0);
    z.vertrauen = clamp(z.vertrauen + delta, -100, 100);
    z.verlauf.push({ frage: text(state, knoten.text, b), antwort: text(state, a.text, b), ton: a.ton, vertrauensAenderung: delta });
    z.effekte.push(...(a.effekte ?? []));
    if (a.offenbart && z.vertrauen >= B.dialog.offenbarenAb) {
      for (const i of a.offenbart) if (!p.bekannt.includes(i) && !z.offenbart.includes(i)) z.offenbart.push(i);
    }
    if (a.ende !== undefined) {
      z.beendet = true;
      z.endText = text(state, a.ende, b);
      knoten = undefined;
      break;
    }
    const w = a.weiter;
    let ziel: string | undefined;
    if (typeof w === 'string') ziel = w;
    else if (w) {
      const ok =
        (w.vertrauenAb === undefined || z.vertrauen >= w.vertrauenAb) &&
        (w.bedingung ?? []).every((c) => bedingungErfuellt(state, p, b, z.vertrauen, c));
      ziel = ok ? w.dann : w.sonst;
    }
    knoten = ziel ? dialog.knoten[ziel] : undefined;
    if (!knoten) {
      z.fehler = `Folgeknoten ${String(ziel)} fehlt im Dialog ${dialog.id}.`;
      return z;
    }
  }
  if (knoten) {
    z.frage = text(state, knoten.text, b);
    z.antworten = knoten.antworten.map((a) => ({
      id: a.id,
      text: text(state, a.text, b),
      ton: a.ton,
      moeglich: antwortMoeglich(state, p, b, z.vertrauen, a)
    }));
  }
  return z;
}

/** Wann wurde dieser Dialog mit der Person zuletzt geführt (absolute Woche)? */
function letztesGespraech(p: Person, dialogId: string): number | null {
  const e = [...p.gespraeche].reverse().find((g) => g.dialogId === dialogId);
  return e ? absoluteWoche({ saison: e.saison, woche: e.woche }) : null;
}

/** Dialoge, die mit dieser Person aktiv geführt werden können. */
export function verfuegbareDialoge(state: GameState, personId: Id): { dialog: DialogDef; gesperrt: string | null }[] {
  const p = personVon(state, personId);
  if (!p) return [];
  if (p.rolle === 'kind' && p.status === 'ausgetreten') return [];
  if (p.rolle === 'trainer' && p.status !== 'aktiv') return [];
  if (p.rolle === 'elternteil') {
    const aktiv = (state.familien[p.familieId]?.kinderIds ?? []).some((id) => state.kinder[id]?.status !== 'ausgetreten');
    if (!aktiv) return [];
  }
  const jetzt = absoluteWoche(state);
  return DIALOGE.filter((d) => d.manuell && d.art === p.rolle)
    .filter((d) => {
      const b = dialogBeteiligte(state, d, personId);
      return (d.bedingung ?? []).every((c) => bedingungErfuellt(state, p, b, p.vertrauen, c));
    })
    .map((d) => {
      const letzte = letztesGespraech(p, d.id);
      const gesperrt =
        letzte !== null && jetzt - letzte < B.dialog.abkuehlungWochen
          ? `Erst wieder in ${B.dialog.abkuehlungWochen - (jetzt - letzte)} Woche(n) möglich.`
          : null;
      return { dialog: d, gesperrt };
    });
}

export function dialogAbkuehlungAktiv(state: GameState, p: Person, dialogId: string): boolean {
  const letzte = letztesGespraech(p, dialogId);
  return letzte !== null && absoluteWoche(state) - letzte < B.dialog.abkuehlungWochen;
}
