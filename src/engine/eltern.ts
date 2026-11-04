// Eltern-Einfluss (Etappe 2): Ansteckung der Stimmung, Familien-Beziehungen,
// Zahlungsmoral und Ausstände, Helfer:innen (Fahrdienst), Interessenkonflikte.
import { B } from './config';
import { buchen, jahresbeitrag } from './finanzen';
import type { WochenInfo } from './kalender';
import { name, teamKinder, teamTrainer } from './personen';
import type { Rng } from './rng';
import type { Buchung, Elternteil, Familie, GameState, Id, Kind, Team } from './types';
import { clamp, round1 } from './util';

/** Eltern aller (aktiven oder schnuppernden) Kinder eines Teams */
export function teamEltern(state: GameState, teamId: Id): Elternteil[] {
  const ids = new Set<Id>();
  for (const k of teamKinder(state, teamId)) for (const e of state.familien[k.familieId]?.elternIds ?? []) ids.add(e);
  return [...ids].map((id) => state.eltern[id]!).filter(Boolean);
}

export function teamHatFahrdienst(state: GameState, teamId: Id): boolean {
  return Object.values(state.eltern).some((e) => e.helfer === 'fahrdienst' && e.helferTeamId === teamId);
}

/** Kind ohne Transport: alle Eltern abwesend und kein Fahrdienst im Team */
export function ohneTransport(state: GameState, k: Kind): boolean {
  if (!k.teamId || teamHatFahrdienst(state, k.teamId)) return false;
  const eltern = (state.familien[k.familieId]?.elternIds ?? []).map((id) => state.eltern[id]).filter(Boolean);
  return eltern.length > 0 && eltern.every((e) => e!.typ === 'abwesend');
}

/** Elternteile, die als Trainer:in im Team ihres eigenen Kindes sind */
export function interessenkonflikte(state: GameState, team: Team): { trainerId: Id; kindIds: Id[] }[] {
  const res: { trainerId: Id; kindIds: Id[] }[] = [];
  for (const t of teamTrainer(state, team)) {
    if (!t.elternteilId) continue;
    const e = state.eltern[t.elternteilId];
    if (!e) continue;
    const kinder = teamKinder(state, team.id).filter((k) => k.familieId === e.familieId).map((k) => k.id);
    if (kinder.length > 0) res.push({ trainerId: t.id, kindIds: kinder });
  }
  return res;
}

/** Vernetzt eine Familie mit anderen Familien im Team (Freundschaften zwischen Eltern). */
export function familieVernetzen(state: GameState, rng: Rng, familieId: Id, teamId: Id): void {
  const eigene = state.familien[familieId];
  const ich = eigene ? state.eltern[eigene.elternIds[0] ?? ''] : undefined;
  if (!ich) return;
  const andere = new Set<Id>();
  for (const k of teamKinder(state, teamId)) if (k.familieId !== familieId) andere.add(k.familieId);
  for (const fid of andere) {
    if (!rng.chance(B.eltern.freundschaftWahrscheinlichkeit)) continue;
    const du = state.eltern[state.familien[fid]?.elternIds[0] ?? ''];
    if (!du || ich.beziehungen.some((b) => b.zielId === du.id)) continue;
    const staerke = rng.int(30, 60);
    ich.beziehungen.push({ zielId: du.id, art: 'freundschaft', staerke });
    du.beziehungen.push({ zielId: ich.id, art: 'freundschaft', staerke });
  }
}

/** Ansteckung: Stimmung breitet sich im Team aus, gewichtet nach Einfluss und Freundschaften. */
export function elternAnsteckung(state: GameState): void {
  const E = B.eltern;
  const vorher: Record<Id, number> = {};
  for (const e of Object.values(state.eltern)) vorher[e.id] = e.stimmung;
  const aenderung: Record<Id, number> = {};
  for (const team of Object.values(state.teams)) {
    const eltern = teamEltern(state, team.id);
    if (eltern.length < 2) continue;
    const gewicht = eltern.reduce((s, e) => s + e.einfluss, 0);
    const mittel = eltern.reduce((s, e) => s + e.einfluss * vorher[e.id]!, 0) / gewicht;
    for (const e of eltern) aenderung[e.id] = (aenderung[e.id] ?? 0) + E.ansteckung * (mittel - vorher[e.id]!);
  }
  for (const e of Object.values(state.eltern)) {
    for (const b of e.beziehungen) {
      if (b.art !== 'freundschaft' || b.staerke < 30) continue;
      const v = vorher[b.zielId];
      if (v === undefined) continue;
      aenderung[e.id] = (aenderung[e.id] ?? 0) + E.freundschaftZug * (v - vorher[e.id]!);
    }
  }
  for (const [id, d] of Object.entries(aenderung)) {
    const e = state.eltern[id]!;
    e.stimmung = clamp(round1(e.stimmung + d), 0, 100);
  }
}

function aktiveKinderDerFamilie(state: GameState, f: Familie): Kind[] {
  return f.kinderIds.map((id) => state.kinder[id]).filter((k): k is Kind => !!k && k.status === 'aktiv');
}

function zahlungsmoral(state: GameState, f: Familie): number {
  const werte = f.elternIds.map((id) => state.eltern[id]?.zahlungsmoral ?? 10);
  return Math.min(...werte);
}

/**
 * Wöchentliche Beitragszahlungen pro Familie. Säumige Familien zahlen nicht;
 * der Betrag wird zum Ausstand. Familien mit Ratenzahlung tragen den Ausstand ab.
 */
export function zahlungen(state: GameState, rng: Rng, buchungen: Buchung[]): { bezahlt: number; offen: number; raten: number } {
  const Z = B.eltern.zahlung;
  let bezahlt = 0;
  let offen = 0;
  let raten = 0;
  for (const f of Object.values(state.familien)) {
    const kinder = aktiveKinderDerFamilie(state, f);
    if (kinder.length === 0) continue;
    const faellig = kinder.reduce((s, k) => s + jahresbeitrag(state, k) / B.spiel.wochenProSaison, 0);
    if (f.saeumig) {
      if (rng.chance(Z.erholung)) f.saeumig = false;
    } else {
      const zm = zahlungsmoral(state, f);
      const p = Z.saeumigBasis + Math.max(0, 20 - zm) * Z.saeumigProPunktUnter20 + (f.einkommen === 'tief' && !f.haertefall ? Z.tiefesEinkommenZusatz : 0);
      if (rng.chance(p)) f.saeumig = true;
    }
    if (f.saeumig) {
      f.ausstand = Math.round((f.ausstand + faellig) * 100) / 100;
      offen += faellig;
    } else {
      bezahlt += faellig;
      if (f.ratenzahlung && f.ausstand > 0) {
        const rate = Math.min(f.ausstand, Math.max(faellig, f.ausstand * Z.ratenAnteil));
        f.ausstand = Math.round((f.ausstand - rate) * 100) / 100;
        raten += rate;
        if (f.ausstand <= 0.01) {
          f.ausstand = 0;
          f.ratenzahlung = false;
        }
      }
    }
  }
  buchen(state, { kategorie: 'beitraege', text: 'Mitgliederbeiträge', betrag: bezahlt }, buchungen);
  if (raten > 0) buchen(state, { kategorie: 'beitraege', text: 'Ratenzahlungen offener Beiträge', betrag: raten }, buchungen);
  return { bezahlt, offen, raten };
}

/** Zahlungserinnerung bzw. Umgang mit einem Ausstand (Effekt aus Ereignissen und Dialogen). */
export function ausstandBehandeln(
  state: GameState,
  rng: Rng,
  f: Familie,
  aktion: string,
  buchungen: Buchung[],
  meldungen: string[]
): void {
  const Z = B.eltern.zahlung;
  const eltern = f.elternIds.map((id) => state.eltern[id]).filter((e): e is Elternteil => !!e);
  switch (aktion) {
    case 'freundlich':
      if (rng.chance(Z.freundlichErfolg)) {
        f.saeumig = false;
        f.ratenzahlung = true;
        meldungen.push(`Familie ${f.nachname} zahlt den Ausstand in Raten ab.`);
      } else {
        meldungen.push(`Familie ${f.nachname} reagiert nicht auf die Erinnerung.`);
      }
      break;
    case 'streng': {
      for (const e of eltern) e.stimmung = clamp(e.stimmung + Z.strengStimmung, 0, 100);
      const faktor = f.einkommen === 'tief' ? 2 : 1;
      for (const k of aktiveKinderDerFamilie(state, f)) k.austrittsRisikoZusatz += Z.strengAustrittsrisiko * faktor;
      if (rng.chance(Z.strengErfolg)) {
        buchen(state, { kategorie: 'beitraege', text: `Ausstand Familie ${f.nachname}`, betrag: f.ausstand }, buchungen);
        f.ausstand = 0;
        f.saeumig = false;
        meldungen.push(`Familie ${f.nachname} begleicht den Ausstand – verärgert.`);
      } else {
        meldungen.push(`Familie ${f.nachname} kann trotz Mahnung nicht zahlen.`);
      }
      break;
    }
    case 'raten':
      f.saeumig = false;
      f.ratenzahlung = true;
      break;
    case 'haertefall':
      f.haertefall = true;
      f.ausstand = Math.round((f.ausstand / 2) * 100) / 100;
      f.saeumig = false;
      f.ratenzahlung = f.ausstand > 0;
      break;
    case 'abschreiben':
      f.ausstand = 0;
      f.saeumig = false;
      f.ratenzahlung = false;
      for (const e of eltern) e.stimmung = clamp(e.stimmung + 5, 0, 100);
      break;
  }
}

/** Wöchentlicher Eltern-Teil der Simulation (nach der Zufriedenheit). */
export function elternWoche(state: GameState, info: WochenInfo, teamsMitSpiel: Set<Id>, meldungen: string[]): void {
  const E = B.eltern;
  // Stimmung folgt den eigenen Kindern
  for (const e of Object.values(state.eltern)) {
    const f = state.familien[e.familieId];
    const kinder = (f?.kinderIds ?? []).map((id) => state.kinder[id]).filter((k): k is Kind => !!k && k.status !== 'ausgetreten');
    if (kinder.length === 0) continue;
    const z = kinder.reduce((s, k) => s + k.zufriedenheit, 0) / kinder.length;
    e.stimmung = clamp(round1(e.stimmung + E.stimmungZuKind * (z - e.stimmung)), 0, 100);
  }
  elternAnsteckung(state);

  // Helfer:innen
  const H = E.helfer;
  for (const e of Object.values(state.eltern)) {
    if (!e.helfer) {
      e.auslastung = clamp(e.auslastung + H.auslastungOhneSpiel, 0, 100);
      continue;
    }
    const team = e.helferTeamId ? state.teams[e.helferTeamId] : undefined;
    const kinderAktiv = (state.familien[e.familieId]?.kinderIds ?? []).some((id) => state.kinder[id]?.status === 'aktiv');
    if (!team || !kinderAktiv) {
      e.helfer = null;
      e.helferTeamId = null;
      continue;
    }
    if (info.ferien) e.auslastung = clamp(e.auslastung + H.auslastungFerien, 0, 100);
    else if (teamsMitSpiel.has(team.id)) {
      e.auslastung = clamp(e.auslastung + H.auslastungMitSpiel, 0, 100);
      for (const t of teamTrainer(state, team)) t.belastung = clamp(t.belastung - H.trainerEntlastung, 0, 100);
    } else e.auslastung = clamp(e.auslastung + H.auslastungOhneSpiel, 0, 100);
    if (e.auslastung > H.limit) e.stimmung = clamp(e.stimmung - 1, 0, 100);
  }

  // Interessenkonflikt: andere Eltern merken Bevorzugung
  for (const team of Object.values(state.teams)) {
    if (team.flags['einsatzregeln']) continue;
    const konflikte = interessenkonflikte(state, team);
    if (konflikte.length === 0) continue;
    const eigeneFamilien = new Set(konflikte.flatMap((c) => c.kindIds.map((id) => state.kinder[id]!.familieId)));
    for (const e of teamEltern(state, team.id)) {
      if (!eigeneFamilien.has(e.familieId)) e.stimmung = clamp(e.stimmung + E.interessenkonflikt.stimmungAndere, 0, 100);
    }
  }

  // Vertrauen verblasst langsam
  for (const p of [...Object.values(state.eltern), ...Object.values(state.kinder), ...Object.values(state.trainer)]) {
    if (p.vertrauen !== 0) p.vertrauen = round1(p.vertrauen * (1 - E.vertrauenZerfall));
  }
  void meldungen;
}

/** Elternabend für ein Team (Entscheid). */
export function elternabend(
  state: GameState,
  team: Team,
  info: WochenInfo,
  buchungen: Buchung[],
  meldungen: string[],
  /** false in der Vorschau: Beobachtungen erst bei der echten Simulation */
  aufdecken = true
): void {
  const A = B.eltern.elternabend;
  const faktor = info.phase === 'trainingsstart' ? A.trainingsstartFaktor : 1;
  buchen(state, { kategorie: 'elternarbeit', text: `Elternabend ${team.name}`, betrag: -A.kosten }, buchungen);
  for (const t of teamTrainer(state, team)) t.belastung = clamp(t.belastung + A.trainerBelastung, 0, 100);
  const aufgefallen: string[] = [];
  for (const e of teamEltern(state, team.id)) {
    e.stimmung = clamp(e.stimmung + A.stimmung * faktor, 0, 100);
    e.vertrauen = clamp(e.vertrauen + A.vertrauen * faktor, -100, 100);
    e.engagement = clamp(e.engagement + 1, 1, 20);
    if (aufdecken && (e.einfluss >= A.auffaelligEinfluss || e.konfliktbereitschaft >= A.auffaelligKonflikt) && !e.bekannt.includes('typ')) {
      e.bekannt.push('typ');
      aufgefallen.push(name(e));
    }
  }
  team.flags['einsatzregeln'] = true;
  team.elternabende += 1;
  meldungen.push(
    `Elternabend ${team.name}: Einsatzregeln und Saisonplanung erklärt.` +
      (aufgefallen.length ? ` Aufgefallen sind dir: ${aufgefallen.join(', ')}.` : '')
  );
}
