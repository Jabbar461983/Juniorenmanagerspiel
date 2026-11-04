// Vorstand und Einfluss (Etappe 3): Sitzungen mit Anträgen, Einfluss, GV,
// Konkurs-Kette und vorzeitiges Spielende.
import { B, amtName } from './config';
import { buchen } from './finanzen';
import { erzeugeVorstandsmitglied } from './generator';
import { absoluteWoche, aktuelleWoche } from './kalender';
import { aktiveKinder, durchschnittZufriedenheit, name, teamKinder, teamTrainer } from './personen';
import type { Rng } from './rng';
import type {
  Antrag,
  AntragErgebnis,
  AntragTyp,
  Buchung,
  ChronikEintrag,
  GameState,
  Prioritaet,
  Spielende,
  VorstandState,
  Vorstandsmitglied
} from './types';
import { clamp, neueId, round1 } from './util';

export const ANTRAG_NAMEN: Record<AntragTyp, string> = {
  budget: 'Zusätzliches Budget',
  neuesTeam: 'Zuschuss für ein neues Team',
  trainerentschaedigung: 'Zuschuss Trainerentschädigung',
  material: 'Zuschuss Material',
  hallenzeiten: 'Mehr und günstigere Hallenzeiten'
};

export function leererVorstand(): VorstandState {
  return {
    mitglieder: {},
    spielerImVorstand: false,
    offeneAntraege: [],
    vorbereitung: 0,
    sitzungen: [],
    einflussVerlauf: [],
    jahresbudget: B.vorstand.gv.basisbudget,
    gv: [],
    hallenRabatt: 0,
    konkursStufe: 0,
    rettungsplan: false,
    kuerzung: 0,
    wochenOhneTeam: 0
  };
}

/** Erzeugt die fünf Vorstandsmitglieder. */
export function erzeugeVorstand(state: GameState, rng: Rng): void {
  const v = state.vorstand;
  const plan: [Vorstandsmitglied['amt'], Prioritaet, number][] = [
    ['praesidium', rng.pick(['image', 'junioren', 'breitensport'] as Prioritaet[]), rng.int(0, 40)],
    ['kasse', 'finanzen', rng.int(-40, 10)],
    ['sportchef', rng.chance(0.7) ? 'aktivmannschaft' : 'junioren', rng.int(-30, 30)],
    ['kommunikation', 'image', rng.int(-20, 40)],
    ['beisitz', rng.pick(['aktivmannschaft', 'breitensport', 'junioren', 'finanzen'] as Prioritaet[]), rng.int(-40, 40)]
  ];
  for (const [amt, prio, haltung] of plan) {
    const m = erzeugeVorstandsmitglied(state, rng, amt, prio, haltung);
    v.mitglieder[m.id] = m;
  }
}

export function einfluss(state: GameState): number {
  return state.verein.vorstandEinfluss;
}

export function haltungKategorie(h: number): 'unterstuetzer' | 'neutral' | 'skeptisch' {
  if (h >= B.vorstand.haltung.verbuendeterAb) return 'unterstuetzer';
  if (h <= B.vorstand.haltung.skeptikerBis) return 'skeptisch';
  return 'neutral';
}

export const HALTUNG_NAMEN = { unterstuetzer: 'Unterstützer:in', neutral: 'neutral', skeptisch: 'skeptisch' } as const;

export function chronik(state: GameState, art: ChronikEintrag['art'], text: string): void {
  state.chronik.push({ saison: state.saison, woche: state.woche, art, text });
}

export function einflussAendern(state: GameState, delta: number): void {
  state.verein.vorstandEinfluss = clamp(round1(state.verein.vorstandEinfluss + delta), 0, 100);
}

export function haltungAendern(m: Vorstandsmitglied, delta: number): void {
  m.haltung = clamp(Math.round(m.haltung + delta), -100, 100);
}

/** Ist diese Woche (state.woche) eine Vorstandssitzung? */
export function istSitzungswoche(state: Pick<GameState, 'saison' | 'woche'>): boolean {
  return absoluteWoche(state) % B.vorstand.sitzungAlleWochen === 0;
}

/** Wochen bis zur nächsten Sitzung (0 = diese Woche) */
export function wochenBisSitzung(state: Pick<GameState, 'saison' | 'woche'>): number {
  const n = B.vorstand.sitzungAlleWochen;
  return (n - (absoluteWoche(state) % n)) % n;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Zustimmungswahrscheinlichkeit eines Mitglieds zu einem Antrag. */
export function zustimmung(state: GameState, m: Vorstandsmitglied, antrag: Pick<Antrag, 'typ' | 'betrag'>): number {
  const A = B.vorstand.abstimmung;
  let x = m.haltung * A.haltung + (einfluss(state) - 50) * A.einfluss + state.vorstand.vorbereitung;
  x -= (antrag.betrag / 100) * A.betragPro100;
  if (state.vorstand.konkursStufe >= 1) x += A.kasseKrise;
  // Antragsmüdigkeit: jeder in dieser Saison genehmigte Antrag macht zurückhaltender
  const genehmigt = state.vorstand.sitzungen
    .filter((z) => z.saison === state.saison)
    .reduce((n, z) => n + z.ergebnisse.filter((e) => e.angenommen).length, 0);
  x += genehmigt * A.proGenehmigtemAntrag;
  const P = A.prioritaet;
  if (m.prioritaet === 'junioren') x += P.junioren;
  if (m.prioritaet === 'finanzen' && antrag.typ !== 'hallenzeiten') x += P.finanzenBudget;
  if (m.prioritaet === 'aktivmannschaft' && antrag.typ === 'hallenzeiten') x += P.aktivmannschaftHalle;
  if (m.prioritaet === 'image' && state.verein.ruf >= 60) x += P.imageRuf;
  if (m.prioritaet === 'breitensport' && (antrag.typ === 'neuesTeam' || antrag.typ === 'hallenzeiten')) x += P.breitensport;
  return sigmoid(x / A.skala);
}

export function abstimmen(state: GameState, rng: Rng, antrag: Antrag): AntragErgebnis {
  const stimmen: AntragErgebnis['stimmen'] = [];
  for (const m of Object.values(state.vorstand.mitglieder)) {
    stimmen.push({ mitgliedId: m.id, ja: rng.chance(zustimmung(state, m, antrag)) });
  }
  if (state.vorstand.spielerImVorstand) stimmen.push({ mitgliedId: 'spieler', ja: true });
  const ja = stimmen.filter((s) => s.ja).length;
  const nein = stimmen.length - ja;
  let angenommen = ja > nein;
  if (ja === nein) {
    const praesidium = Object.values(state.vorstand.mitglieder).find((m) => m.amt === 'praesidium');
    angenommen = !!stimmen.find((s) => s.mitgliedId === praesidium?.id)?.ja;
  }
  return { antrag, stimmen, angenommen };
}

function antragUmsetzen(state: GameState, e: AntragErgebnis, buchungen: Buchung[], meldungen: string[]): void {
  const a = e.antrag;
  const E = B.vorstand.einfluss;
  if (!e.angenommen) {
    einflussAendern(state, a.betrag >= 1500 ? E.abgelehntGross : E.abgelehnt);
    meldungen.push(`Vorstand lehnt ab: ${ANTRAG_NAMEN[a.typ]}${a.betrag ? ` (CHF ${a.betrag})` : ''}.`);
    return;
  }
  einflussAendern(state, E.angenommen);
  if (a.typ === 'hallenzeiten') {
    state.vorstand.hallenRabatt = B.vorstand.hallenRabatt;
    meldungen.push('Vorstand genehmigt: zusätzliche, günstigere Hallenzeiten (Hallenmiete −30 % für den Rest der Saison).');
  } else {
    buchen(state, { kategorie: 'vorstand', text: `Zuschuss Vorstand: ${ANTRAG_NAMEN[a.typ]}`, betrag: a.betrag }, buchungen);
    meldungen.push(`Vorstand genehmigt: ${ANTRAG_NAMEN[a.typ]} (CHF ${a.betrag}).`);
  }
}

/** Monatliche Einfluss- und Haltungsentwicklung. */
function monatsbilanz(state: GameState): void {
  const E = B.vorstand.einfluss;
  const H = B.vorstand.haltung;
  const z = durchschnittZufriedenheit(state);
  const wachstum = aktiveKinder(state).length - state.saisonStatistik.mitgliederStart;
  const mitglieder = Object.values(state.vorstand.mitglieder);
  let delta =
    wachstum * E.wachstumProKind +
    (z - E.zufriedenheitBasis) * E.zufriedenheitFaktor +
    (state.verein.ruf - 50) * E.rufFaktor +
    mitglieder.filter((m) => haltungKategorie(m.haltung) === 'unterstuetzer').length * E.verbuendeter +
    mitglieder.filter((m) => haltungKategorie(m.haltung) === 'skeptisch').length * E.skeptiker;
  if (state.finanzen.kasse < 0) delta += E.kasseNegativ;
  delta += (50 - einfluss(state)) * E.rueckstellung;
  einflussAendern(state, clamp(delta, -E.maxProSitzung, E.maxProSitzung));
  for (const m of mitglieder) {
    let d = (z - E.zufriedenheitBasis) * H.zufriedenheitFaktor;
    if (m.prioritaet === 'finanzen') d += state.finanzen.kasse < 0 ? H.finanzenKasseNegativ : H.finanzenKassePositiv;
    if (m.prioritaet === 'image') d += (state.verein.ruf - 50) * H.imageRufFaktor;
    if (m.prioritaet === 'junioren') d += H.junioren;
    d -= m.haltung * H.rueckstellung;
    haltungAendern(m, d);
  }
}

/** Vorstandssitzung (alle 4 Wochen). */
export function sitzung(state: GameState, rng: Rng, buchungen: Buchung[], meldungen: string[]): void {
  if (!istSitzungswoche(state)) return;
  const v = state.vorstand;
  const vorher = einfluss(state);
  const zuBehandeln = v.offeneAntraege.slice(0, B.vorstand.maxAntraegeProSitzung);
  v.offeneAntraege = v.offeneAntraege.slice(B.vorstand.maxAntraegeProSitzung);
  const ergebnisse = zuBehandeln.map((a) => abstimmen(state, rng, a));
  for (const e of ergebnisse) antragUmsetzen(state, e, buchungen, meldungen);
  monatsbilanz(state);
  v.sitzungen.push({ saison: state.saison, woche: state.woche, vorbereitung: v.vorbereitung, ergebnisse, einflussVorher: vorher, einflussNachher: einfluss(state) });
  v.einflussVerlauf.push({ saison: state.saison, woche: state.woche, wert: einfluss(state) });
  v.vorbereitung = 0;
  meldungen.push(`Vorstandssitzung: Einfluss ${Math.round(vorher)} → ${Math.round(einfluss(state))}.`);
}

/** GV im Mai: Jahresbudget für die nächste Saison, Wahl in den Vorstand. */
export function generalversammlung(state: GameState, meldungen: string[]): void {
  const G = B.vorstand.gv;
  if (state.woche !== G.woche) return;
  const v = state.vorstand;
  const e = einfluss(state);
  const kinder = aktiveKinder(state).length;
  const roh = G.basisbudget * (G.einflussFaktorMin + (e / 100) * G.einflussFaktorSpanne) + kinder * G.proKind;
  const budget = Math.round((roh * (1 - v.kuerzung)) / 100) * 100;
  v.jahresbudget = budget;
  const gewaehlt = !v.spielerImVorstand && e >= G.wahlAbEinfluss;
  if (gewaehlt) v.spielerImVorstand = true;
  const stimmung = Math.round((durchschnittZufriedenheit(state) + state.verein.ruf) / 2);
  const text =
    `GV: Jahresbudget für die nächste Saison CHF ${budget.toLocaleString('de-CH')}` +
    (v.kuerzung > 0 ? ` (inkl. Kürzung ${Math.round(v.kuerzung * 100)} %)` : '') +
    '.' +
    (gewaehlt ? ' Du wirst in den Vorstand gewählt und stimmst künftig mit.' : '') +
    ` Stimmung an der GV: ${stimmung >= 65 ? 'gut' : stimmung >= 50 ? 'gemischt' : 'kritisch'}.`;
  v.gv.push({ saison: state.saison, jahresbudget: budget, gewaehlt, stimmung, text });
  v.kuerzung = 0;
  meldungen.push(text);
  chronik(state, 'vorstand', text);
  state.posteingang.push({
    id: neueId(state, 'n'),
    saison: state.saison,
    woche: state.woche,
    absender: 'Präsident:in',
    titel: 'Ergebnis der GV',
    text,
    gelesen: false,
    wichtig: true
  });
}

function beenden(state: GameState, grund: Spielende['grund'], text: string): void {
  if (state.spielende) return;
  state.spielende = { grund, punkte: 0, titel: '', text };
  chronik(state, 'krise', text);
}

/** Konkurs-Kette, Absetzung und Auflösung (wöchentlich nach den Buchungen). */
export function vereinsPruefung(state: GameState, meldungen: string[], erzeugePflichtereignis: (vorlageId: string) => void): void {
  const v = state.vorstand;
  const K = B.vorstand.konkurs;
  const unterNull = state.finanzen.wochenUnterNull;
  if (state.finanzen.kasse < 0) einflussAendern(state, B.vorstand.einfluss.kasseNegativWoche);

  if (unterNull === 0) {
    if (v.konkursStufe > 0) meldungen.push('Die Kasse ist wieder im Plus. Der Vorstand ist erleichtert.');
    v.konkursStufe = 0;
    v.rettungsplan = false;
  } else {
    if (unterNull >= K.stufe1 && v.konkursStufe < 1) {
      v.konkursStufe = 1;
      erzeugePflichtereignis('budget_massnahmen');
    }
    if (unterNull >= K.stufe2 && v.konkursStufe < 2) {
      v.konkursStufe = 2;
      v.kuerzung = Math.min(0.6, v.kuerzung + K.kuerzung);
      einflussAendern(state, K.einflussKuerzung);
      const text = `Der Vorstand kürzt das nächste Jahresbudget um ${Math.round(K.kuerzung * 100)} %, weil die Kasse seit ${unterNull} Wochen im Minus ist.`;
      meldungen.push(text);
      chronik(state, 'finanzen', text);
      state.posteingang.push({ id: neueId(state, 'n'), saison: state.saison, woche: state.woche, absender: 'Kassier:in', titel: 'Budgetkürzung', text, gelesen: false, wichtig: true });
    }
    const grenze = v.rettungsplan ? K.stufe3MitRettungsplan : K.stufe3;
    if (unterNull >= grenze && v.konkursStufe < 3) {
      if (state.lernmodus) {
        einflussAendern(state, K.einflussAbsetzungLernmodus);
        state.finanzen.wochenUnterNull = K.stufe2;
        meldungen.push('Lernmodus: Ohne Lernmodus wärst du jetzt wegen der Finanzen abgesetzt worden.');
      } else {
        v.konkursStufe = 3;
        beenden(state, 'konkurs', 'Budgetkonkurs: Die Kasse ist zu lange im Minus, ohne tragfähigen Rettungsplan. Der Vorstand setzt dich ab.');
      }
    }
  }

  if (einfluss(state) < B.vorstand.absetzungUnterEinfluss) {
    if (state.lernmodus) {
      if (aktuelleWoche(state).woche % 4 === 0) meldungen.push('Lernmodus: Dein Einfluss ist so tief, dass dich der Vorstand sonst absetzen würde.');
    } else {
      beenden(state, 'absetzung', 'Der Vorstand hat das Vertrauen verloren und setzt dich als Juniorenverantwortliche:r ab.');
    }
  }

  const spielfaehig = Object.values(state.teams).some(
    (t) => teamKinder(state, t.id, false).length >= B.vorstand.minKinderSpielfaehig && teamTrainer(state, t).length > 0
  );
  v.wochenOhneTeam = spielfaehig ? 0 : v.wochenOhneTeam + 1;
  if (v.wochenOhneTeam >= B.vorstand.ohneTeamWochen) {
    if (state.lernmodus) meldungen.push('Lernmodus: Kein Team ist mehr spielfähig – ohne Lernmodus wäre die Abteilung aufgelöst.');
    else beenden(state, 'aufgeloest', 'Die Juniorenabteilung wird aufgelöst: Seit Wochen ist kein Team mehr spielfähig.');
  }
}

/** Neues Antrag-Objekt */
export function neuerAntrag(state: GameState, typ: AntragTyp, betrag: number): Antrag {
  return {
    id: neueId(state, 'a'),
    typ,
    betrag: typ === 'hallenzeiten' ? 0 : clamp(Math.round(betrag / 50) * 50, 0, B.vorstand.maxBetrag),
    saison: state.saison,
    woche: state.woche
  };
}

export function vorstandText(m: Vorstandsmitglied): string {
  return `${name(m)} (${amtName(m.amt)})`;
}
