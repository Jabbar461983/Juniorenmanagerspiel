// Wettkampf: U9-Turniere, Ligen U12/U15 mit Finalturnier, U18-Meisterschaft mit Playoffs (best of 3).
import { B, GEGNER_VEREINE } from './config';
import { saisonKalender, saisonJahr } from './kalender';
import { spielstaerkeKind, teamKinder, teamsDerStufe } from './personen';
import type { Rng } from './rng';
import { berechneTeamWerte } from './teamwert';
import type { GameState, Id, Liga, Meisterschaft, Serie, Spiel, Stufe, Team, Wettkampf, WettkampfTeam } from './types';
import { clamp } from './util';

export function leererWettkampf(): Wettkampf {
  const liga = (stufe: 'U12' | 'U15'): Liga => ({
    stufe,
    teams: [],
    turnierWochen: [],
    finalWoche: 0,
    spiele: [],
    finalTeilnehmer: [],
    finalRangliste: []
  });
  return {
    gestartet: false,
    u9: { turnierWochen: [], spiele: [], teilnehmer: [] },
    ligen: { U12: liga('U12'), U15: liga('U15') },
    u18: { teams: [], runden: [], spiele: [], playoffStartWoche: 0, setzliste: [], playoffs: [] }
  };
}

/** Verteilt n Termine gleichmässig über eine Liste von Wochen. */
export function verteile(wochen: number[], n: number): number[] {
  if (wochen.length === 0) return [];
  const res: number[] = [];
  for (let i = 0; i < n; i++) {
    res.push(wochen[Math.min(wochen.length - 1, Math.floor(((i + 0.5) * wochen.length) / n))]!);
  }
  return res;
}

/** Jeder gegen jeden (Kreismethode). Liefert Runden mit Paarungen. */
export function jederGegenJeden(ids: Id[]): [Id, Id][][] {
  const liste: (Id | null)[] = [...ids];
  if (liste.length % 2 === 1) liste.push(null);
  const n = liste.length;
  const runden: [Id, Id][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const paarungen: [Id, Id][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = liste[i];
      const b = liste[n - 1 - i];
      if (a && b) paarungen.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    runden.push(paarungen);
    // rotieren, erstes Element fix
    const fix = liste[0]!;
    const rest = liste.slice(1);
    rest.unshift(rest.pop()!);
    liste.splice(0, liste.length, fix, ...rest);
  }
  return runden;
}

function gegner(rng: Rng, stufe: Stufe, anzahl: number, praefix: string): WettkampfTeam[] {
  const [min, max] = B.wettkampf.gegnerStaerke[stufe] as [number, number];
  return rng
    .shuffle(GEGNER_VEREINE)
    .slice(0, anzahl)
    .map((n, i) => ({ id: `${praefix}${i}`, name: n, staerke: Math.round(rng.float(min, max) * 10) / 10 }));
}

function eigeneTeams(state: GameState, stufe: Stufe): WettkampfTeam[] {
  return teamsDerStufe(state, stufe).map((t) => ({
    id: t.id,
    name: `${state.verein.name} ${t.name}`,
    eigenesTeamId: t.id,
    staerke: 0
  }));
}

/** Startet den Wettkampf (erste Meisterschaftswoche) mit allen aktuellen Teams. */
export function starteWettkampf(state: GameState, rng: Rng): void {
  const wk = leererWettkampf();
  wk.gestartet = true;
  const kalender = saisonKalender(saisonJahr(state));
  const mWochen = kalender.filter((w) => w.phase === 'meisterschaft' && !w.ferien && w.woche >= state.woche).map((w) => w.woche);
  const alleM = kalender.filter((w) => w.phase === 'meisterschaft' && w.woche >= state.woche).map((w) => w.woche);
  const spielWochen = mWochen.length >= 4 ? mWochen : alleM;

  // U9
  wk.u9.turnierWochen = verteile(spielWochen, B.wettkampf.u9Turniere);
  wk.u9.teilnehmer = [...eigeneTeams(state, 'U9'), ...gegner(rng, 'U9', 6, 'g9_')];

  // Ligen U12 / U15
  const abschluss = kalender.find((w) => w.phase === 'abschluss' && !w.ferien);
  for (const stufe of ['U12', 'U15'] as const) {
    const eigene = eigeneTeams(state, stufe).slice(0, B.wettkampf.ligaTeams);
    const liga = wk.ligen[stufe];
    liga.teams = [...eigene, ...gegner(rng, stufe, B.wettkampf.ligaTeams - eigene.length, `g${stufe}_`)];
    liga.turnierWochen = verteile(spielWochen, B.wettkampf.ligaTurniere);
    liga.finalWoche = Math.min(B.spiel.wochenProSaison - 1, (abschluss?.woche ?? 49) + 1);
  }

  // U18 Meisterschaft: Hin- und Rückrunde
  const eigene18 = eigeneTeams(state, 'U18').slice(0, B.wettkampf.u18Teams);
  const m = wk.u18;
  m.teams = [...eigene18, ...gegner(rng, 'U18', B.wettkampf.u18Teams - eigene18.length, 'gU18_')];
  const hin = jederGegenJeden(rng.shuffle(m.teams.map((t) => t.id)));
  const rueck = hin.map((r) => r.map(([a, b]) => [b, a] as [Id, Id]));
  const alleRunden = [...hin, ...rueck];
  const termine = verteile(spielWochen, alleRunden.length);
  m.runden = alleRunden.map((paarungen, i) => ({ woche: termine[i]!, paarungen }));
  m.playoffStartWoche = kalender.find((w) => w.phase === 'playoffs')?.woche ?? 40;

  state.wettkampf = wk;
}

// ---------- Spielsimulation ----------

export interface Staerken {
  [teamId: string]: number;
}

/** Stärke eines eigenen Teams (1–20-Skala) aus Kindern, Trainer-Fachwissen und Anwesenheit. */
export function eigeneStaerke(state: GameState, team: Team, anwesenheit = 1): number {
  const kinder = teamKinder(state, team.id, false);
  if (kinder.length === 0) return 1;
  const n = B.stufen[team.stufe].spielerProSpiel;
  const anwesend = Math.max(1, Math.round(kinder.length * anwesenheit));
  const beste = kinder
    .map(spielstaerkeKind)
    .sort((a, b) => b - a)
    .slice(0, Math.min(n, anwesend));
  let staerke = beste.reduce((s, v) => s + v, 0) / beste.length;
  // Zu wenige Spieler:innen schwächen
  if (anwesend < n * 0.6) staerke *= anwesend / (n * 0.6);
  const werte = berechneTeamWerte(state, team);
  staerke += ((werte.skills.fachwissen / 100) * 20 - 10) * B.wettkampf.trainerFachwissenFaktor;
  return Math.max(1, staerke);
}

function staerkeVon(wt: WettkampfTeam, staerken: Staerken): number {
  return wt.eigenesTeamId ? (staerken[wt.eigenesTeamId] ?? 1) : wt.staerke;
}

export function spielSimulieren(
  rng: Rng,
  heim: number,
  gast: number,
  entscheidungNoetig: boolean
): { toreHeim: number; toreGast: number; nachVerlaengerung: boolean } {
  const W = B.wettkampf;
  const formH = heim + rng.normal(0, W.tagesformStreuung) + 0.3; // leichter Heimvorteil
  const formG = gast + rng.normal(0, W.tagesformStreuung);
  const diff = formH - formG;
  const toreHeim = rng.poisson(W.toreBasis * Math.exp(W.staerkeFaktor * diff));
  const toreGast = rng.poisson(W.toreBasis * Math.exp(-W.staerkeFaktor * diff));
  if (entscheidungNoetig && toreHeim === toreGast) {
    const pHeim = 1 / (1 + Math.exp(-W.staerkeFaktor * 2 * diff));
    return rng.chance(pHeim)
      ? { toreHeim: toreHeim + 1, toreGast, nachVerlaengerung: true }
      : { toreHeim, toreGast: toreGast + 1, nachVerlaengerung: true };
  }
  return { toreHeim, toreGast, nachVerlaengerung: false };
}

// ---------- Tabellen ----------

export interface TabellenZeile {
  id: Id;
  name: string;
  eigen: boolean;
  spiele: number;
  siege: number;
  unentschieden: number;
  niederlagen: number;
  toreFuer: number;
  toreGegen: number;
  punkte: number;
}

export function tabelle(teams: WettkampfTeam[], spiele: Spiel[]): TabellenZeile[] {
  const zeilen = new Map<Id, TabellenZeile>();
  for (const t of teams) {
    zeilen.set(t.id, {
      id: t.id,
      name: t.name,
      eigen: !!t.eigenesTeamId,
      spiele: 0,
      siege: 0,
      unentschieden: 0,
      niederlagen: 0,
      toreFuer: 0,
      toreGegen: 0,
      punkte: 0
    });
  }
  for (const s of spiele) {
    const h = zeilen.get(s.heimId);
    const g = zeilen.get(s.gastId);
    if (!h || !g) continue;
    h.spiele++;
    g.spiele++;
    h.toreFuer += s.toreHeim;
    h.toreGegen += s.toreGast;
    g.toreFuer += s.toreGast;
    g.toreGegen += s.toreHeim;
    if (s.toreHeim > s.toreGast) {
      h.siege++;
      h.punkte += 3;
      g.niederlagen++;
    } else if (s.toreHeim < s.toreGast) {
      g.siege++;
      g.punkte += 3;
      h.niederlagen++;
    } else {
      h.unentschieden++;
      g.unentschieden++;
      h.punkte++;
      g.punkte++;
    }
  }
  return [...zeilen.values()].sort(
    (a, b) =>
      b.punkte - a.punkte ||
      b.toreFuer - b.toreGegen - (a.toreFuer - a.toreGegen) ||
      b.toreFuer - a.toreFuer ||
      a.name.localeCompare(b.name)
  );
}

// ---------- Wochenablauf ----------

export interface SpielMeldung {
  stufe: Stufe;
  text: string;
  /** eigene Team-Id → Ergebnis (+1 Sieg, 0 Unentschieden, −1 Niederlage) pro Spiel */
  ergebnisse: { teamId: Id; resultat: number }[];
}

function eigenErgebnis(s: Spiel, wkTeams: WettkampfTeam[]): { teamId: Id; resultat: number }[] {
  const res: { teamId: Id; resultat: number }[] = [];
  const h = wkTeams.find((t) => t.id === s.heimId);
  const g = wkTeams.find((t) => t.id === s.gastId);
  const r = Math.sign(s.toreHeim - s.toreGast);
  if (h?.eigenesTeamId) res.push({ teamId: h.eigenesTeamId, resultat: r });
  if (g?.eigenesTeamId) res.push({ teamId: g.eigenesTeamId, resultat: -r });
  return res;
}

function spielText(s: Spiel, teams: WettkampfTeam[]): string {
  const n = (id: Id) => teams.find((t) => t.id === id)?.name ?? id;
  return `${n(s.heimId)} – ${n(s.gastId)} ${s.toreHeim}:${s.toreGast}${s.nachVerlaengerung ? ' n.V.' : ''}`;
}

/** Hat ein eigenes Team in einer Woche einen Wettkampf? */
export function hatWettkampf(state: GameState, team: Team, woche: number): boolean {
  const wk = state.wettkampf;
  if (team.stufe === 'U9') return wk.u9.turnierWochen.includes(woche);
  if (team.stufe === 'U12' || team.stufe === 'U15') {
    const liga = wk.ligen[team.stufe];
    if (!liga.teams.some((t) => t.eigenesTeamId === team.id)) return false;
    return liga.turnierWochen.includes(woche) || (liga.finalWoche === woche && liga.finalTeilnehmer.includes(team.id));
  }
  const m = wk.u18;
  if (!m.teams.some((t) => t.eigenesTeamId === team.id)) return false;
  if (m.runden.some((r) => r.woche === woche)) return true;
  return woche >= m.playoffStartWoche && m.playoffs.some((s) => !s.siegerId && (s.hoehergesetztId === team.id || s.tiefergesetztId === team.id));
}

export function simuliereWettkampfWoche(
  state: GameState,
  rng: Rng,
  woche: number,
  staerken: Staerken
): SpielMeldung[] {
  const wk = state.wettkampf;
  if (!wk.gestartet) return [];
  const meldungen: SpielMeldung[] = [];
  const W = B.wettkampf;

  // U9: Turniere ohne Rangliste
  const u9Nr = wk.u9.turnierWochen.indexOf(woche);
  if (u9Nr >= 0) {
    const eigene = wk.u9.teilnehmer.filter((t) => t.eigenesTeamId);
    const fremde = wk.u9.teilnehmer.filter((t) => !t.eigenesTeamId);
    for (const e of eigene) {
      const spiele: Spiel[] = [];
      for (let i = 0; i < W.spieleProTurnier && fremde.length > 0; i++) {
        const g = fremde[(u9Nr * W.spieleProTurnier + i) % fremde.length]!;
        const r = spielSimulieren(rng, staerkeVon(e, staerken), g.staerke, false);
        spiele.push({ woche, heimId: e.id, gastId: g.id, ...r, typ: 'turnier' });
      }
      wk.u9.spiele.push(...spiele);
      meldungen.push({
        stufe: 'U9',
        text: `U9-Turnier ${u9Nr + 1}: ${spiele.map((s) => spielText(s, wk.u9.teilnehmer)).join(', ')} (ohne Rangliste)`,
        ergebnisse: spiele.flatMap((s) => eigenErgebnis(s, wk.u9.teilnehmer))
      });
    }
  }

  // Ligen U12/U15
  for (const stufe of ['U12', 'U15'] as const) {
    const liga = wk.ligen[stufe];
    const nr = liga.turnierWochen.indexOf(woche);
    if (nr >= 0) {
      const runden = jederGegenJeden(liga.teams.map((t) => t.id));
      const spiele: Spiel[] = [];
      for (let i = 0; i < W.spieleProTurnier; i++) {
        const runde = runden[(nr * W.spieleProTurnier + i) % runden.length]!;
        for (const [h, g] of runde) {
          const th = liga.teams.find((t) => t.id === h)!;
          const tg = liga.teams.find((t) => t.id === g)!;
          const r = spielSimulieren(rng, staerkeVon(th, staerken), staerkeVon(tg, staerken), false);
          spiele.push({ woche, heimId: h, gastId: g, ...r, typ: 'liga' });
        }
      }
      liga.spiele.push(...spiele);
      const eigeneSpiele = spiele.filter((s) => eigenErgebnis(s, liga.teams).length > 0);
      if (eigeneSpiele.length > 0) {
        meldungen.push({
          stufe,
          text: `${stufe}-Turnier ${nr + 1}: ${eigeneSpiele.map((s) => spielText(s, liga.teams)).join(', ')}`,
          ergebnisse: eigeneSpiele.flatMap((s) => eigenErgebnis(s, liga.teams))
        });
      }
    }
    if (liga.finalWoche === woche && liga.finalRangliste.length === 0) {
      const tab = tabelle(liga.teams, liga.spiele.filter((s) => s.typ === 'liga'));
      liga.finalTeilnehmer = tab.slice(0, W.finalTeilnehmer).map((z) => z.id);
      const finalTeams = liga.teams.filter((t) => liga.finalTeilnehmer.includes(t.id));
      const spiele: Spiel[] = [];
      for (const runde of jederGegenJeden(liga.finalTeilnehmer)) {
        for (const [h, g] of runde) {
          const th = liga.teams.find((t) => t.id === h)!;
          const tg = liga.teams.find((t) => t.id === g)!;
          const r = spielSimulieren(rng, staerkeVon(th, staerken), staerkeVon(tg, staerken), false);
          spiele.push({ woche, heimId: h, gastId: g, ...r, typ: 'finalturnier' });
        }
      }
      liga.spiele.push(...spiele);
      liga.finalRangliste = tabelle(finalTeams, spiele).map((z) => z.id);
      const eigeneSpiele = spiele.filter((s) => eigenErgebnis(s, liga.teams).length > 0);
      const eigeneRaenge = liga.finalRangliste
        .map((id, i) => ({ id, rang: i + 1 }))
        .filter((x) => liga.teams.find((t) => t.id === x.id)?.eigenesTeamId);
      meldungen.push({
        stufe,
        text:
          `Finalturnier ${stufe}: Sieger ${liga.teams.find((t) => t.id === liga.finalRangliste[0])?.name}.` +
          (eigeneRaenge.length > 0
            ? ` Unser Team: Rang ${eigeneRaenge.map((r) => r.rang).join(', ')}.`
            : ' Unser Team war nicht qualifiziert.'),
        ergebnisse: eigeneSpiele.flatMap((s) => eigenErgebnis(s, liga.teams))
      });
    }
  }

  // U18 Meisterschaft
  const m = wk.u18;
  for (const runde of m.runden.filter((r) => r.woche === woche)) {
    const spiele: Spiel[] = [];
    for (const [h, g] of runde.paarungen) {
      const th = m.teams.find((t) => t.id === h)!;
      const tg = m.teams.find((t) => t.id === g)!;
      const r = spielSimulieren(rng, staerkeVon(th, staerken), staerkeVon(tg, staerken), false);
      spiele.push({ woche, heimId: h, gastId: g, ...r, typ: 'meisterschaft' });
    }
    m.spiele.push(...spiele);
    const eigeneSpiele = spiele.filter((s) => eigenErgebnis(s, m.teams).length > 0);
    if (eigeneSpiele.length > 0) {
      meldungen.push({
        stufe: 'U18',
        text: `U18-Meisterschaft: ${eigeneSpiele.map((s) => spielText(s, m.teams)).join(', ')}`,
        ergebnisse: eigeneSpiele.flatMap((s) => eigenErgebnis(s, m.teams))
      });
    }
  }
  const playoffMeldung = simulierePlayoffWoche(m, rng, woche, staerken);
  if (playoffMeldung) meldungen.push(playoffMeldung);

  return meldungen;
}

const RUNDEN_NAMEN: Record<Serie['runde'], string> = {
  viertelfinal: 'Viertelfinal',
  halbfinal: 'Halbfinal',
  final: 'Final'
};

export function playoffRundeName(r: Serie['runde']): string {
  return RUNDEN_NAMEN[r];
}

/** Paarungen nach Setzliste: Bester gegen Schlechtesten usw. */
function paarungenNachSetzliste(setzliste: Id[], teilnehmer: Id[]): [Id, Id][] {
  const sortiert = [...teilnehmer].sort((a, b) => setzliste.indexOf(a) - setzliste.indexOf(b));
  const res: [Id, Id][] = [];
  for (let i = 0; i < sortiert.length / 2; i++) res.push([sortiert[i]!, sortiert[sortiert.length - 1 - i]!]);
  return res;
}

function neueSerien(runde: Serie['runde'], paare: [Id, Id][]): Serie[] {
  return paare.map(([h, t]) => ({
    runde,
    hoehergesetztId: h,
    tiefergesetztId: t,
    siegeHoeher: 0,
    siegeTiefer: 0,
    spiele: []
  }));
}

/**
 * Playoffs best of 3: pro Woche bis zu zwei Spiele pro Serie (Spiel 1 und 2),
 * ein allfälliges drittes Spiel in der Folgewoche. Die nächste Runde beginnt
 * in der Woche nach Abschluss aller Serien.
 */
export function simulierePlayoffWoche(m: Meisterschaft, rng: Rng, woche: number, staerken: Staerken): SpielMeldung | null {
  if (woche < m.playoffStartWoche || m.meisterId) return null;
  const regulaerFertig = m.runden.every((r) => r.woche < woche);
  if (!regulaerFertig) return null;

  if (m.playoffs.length === 0) {
    const tab = tabelle(m.teams, m.spiele.filter((s) => s.typ === 'meisterschaft'));
    m.setzliste = tab.map((z) => z.id);
    const top = m.setzliste.slice(0, B.wettkampf.playoffTeams);
    m.playoffs = neueSerien('viertelfinal', paarungenNachSetzliste(m.setzliste, top));
  } else {
    const aktuelle = aktuelleRunde(m);
    if (aktuelle && m.playoffs.filter((s) => s.runde === aktuelle).every((s) => s.siegerId)) {
      const sieger = m.playoffs.filter((s) => s.runde === aktuelle).map((s) => s.siegerId!);
      if (aktuelle === 'final') {
        m.meisterId = sieger[0];
        return null;
      }
      const naechste: Serie['runde'] = aktuelle === 'viertelfinal' ? 'halbfinal' : 'final';
      m.playoffs.push(...neueSerien(naechste, paarungenNachSetzliste(m.setzliste, sieger)));
    }
  }

  const runde = aktuelleRunde(m);
  if (!runde) return null;
  const texte: string[] = [];
  const ergebnisse: { teamId: Id; resultat: number }[] = [];
  const erstesSpielDieserWoche = (s: Serie) => s.spiele.filter((sp) => sp.woche < woche).length;
  for (const serie of m.playoffs.filter((s) => s.runde === runde && !s.siegerId)) {
    // in der ersten Woche einer Serie zwei Spiele, danach eines
    const spieleDieseWoche = erstesSpielDieserWoche(serie) === 0 ? 2 : 1;
    for (let i = 0; i < spieleDieseWoche && !serie.siegerId; i++) {
      const nr = serie.spiele.length + 1;
      const heimIstHoeher = nr !== 2;
      const heimId = heimIstHoeher ? serie.hoehergesetztId : serie.tiefergesetztId;
      const gastId = heimIstHoeher ? serie.tiefergesetztId : serie.hoehergesetztId;
      const th = m.teams.find((t) => t.id === heimId)!;
      const tg = m.teams.find((t) => t.id === gastId)!;
      const r = spielSimulieren(rng, staerkeVon(th, staerken), staerkeVon(tg, staerken), true);
      const spiel: Spiel = { woche, heimId, gastId, ...r, typ: 'playoff' };
      serie.spiele.push(spiel);
      m.spiele.push(spiel);
      const heimSieg = r.toreHeim > r.toreGast;
      if (heimSieg === heimIstHoeher) serie.siegeHoeher++;
      else serie.siegeTiefer++;
      if (serie.siegeHoeher >= 2) serie.siegerId = serie.hoehergesetztId;
      if (serie.siegeTiefer >= 2) serie.siegerId = serie.tiefergesetztId;
      const eigen = eigenErgebnis(spiel, m.teams);
      if (eigen.length > 0) {
        ergebnisse.push(...eigen);
        texte.push(`${RUNDEN_NAMEN[runde]} Spiel ${nr}: ${spielText(spiel, m.teams)}`);
      }
    }
  }
  // Final abgeschlossen? Meister direkt setzen
  if (runde === 'final') {
    const f = m.playoffs.find((s) => s.runde === 'final');
    if (f?.siegerId) {
      m.meisterId = f.siegerId;
      texte.push(`U18-Meister: ${m.teams.find((t) => t.id === f.siegerId)?.name}`);
    }
  }
  if (texte.length === 0) return null;
  return { stufe: 'U18', text: texte.join(' · '), ergebnisse };
}

export function aktuelleRunde(m: Meisterschaft): Serie['runde'] | null {
  if (m.playoffs.length === 0) return null;
  const reihenfolge: Serie['runde'][] = ['final', 'halbfinal', 'viertelfinal'];
  for (const r of reihenfolge) if (m.playoffs.some((s) => s.runde === r)) return r;
  return null;
}

/** Einsatzzeit pro anwesendem Kind (0–1), abhängig von Kadergrösse, Stufe und Einsatzregeln. */
export function einsatzzeiten(state: GameState, team: Team, anwesendeIds: Id[]): Record<Id, number> {
  const W = B.wettkampf;
  const n = anwesendeIds.length;
  const res: Record<Id, number> = {};
  if (n === 0) return res;
  const basis = Math.min(1, B.stufen[team.stufe].spielerProSpiel / n);
  let spreizung = W.einsatzLeistungsspreizung[team.stufe];
  if (team.flags['einsatzregeln']) spreizung *= W.einsatzregelnSpreizungFaktor;
  const sortiert = anwesendeIds
    .map((id) => state.kinder[id]!)
    .sort((a, b) => spielstaerkeKind(a) - spielstaerkeKind(b) || a.id.localeCompare(b.id));
  sortiert.forEach((k, i) => {
    const rang = n === 1 ? 0.5 : i / (n - 1);
    res[k.id] = clamp(basis * (1 + spreizung * (rang - 0.5) * 2), 0.1, 1);
  });
  return res;
}
