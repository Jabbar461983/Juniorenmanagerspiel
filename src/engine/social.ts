// Social Media (Etappe 3): Posts, Reichweite, Ruf, Einwilligungen.
import { B } from './config';
import { buchen } from './finanzen';
import { hatWettkampf } from './wettkampf';
import { absoluteWoche } from './kalender';
import { teamKinder } from './personen';
import type { Rng } from './rng';
import type { Bildwahl, Buchung, Elternteil, GameState, Id, Post, PostTyp } from './types';
import { clamp, neueId, round1 } from './util';

export const POST_NAMEN: Record<PostTyp, string> = {
  matchbericht: 'Matchbericht',
  training: 'Einblick ins Training',
  trainerportrait: 'Trainerportrait',
  anlass: 'Bericht über einen Anlass'
};

export const BILD_NAMEN: Record<Bildwahl, string> = {
  keine: 'ohne Bilder von Kindern',
  nurMitEinwilligung: 'nur Kinder mit Einwilligung',
  alle: 'Bilder mit allen Kindern'
};

export type Frequenz = 'selten' | 'regelmaessig' | 'oft';

/** Grundfrequenz der Vereinskommunikation, abhängig von der Haltung der Kommunikationsperson. */
export function frequenz(state: GameState): Frequenz {
  const k = Object.values(state.vorstand.mitglieder).find((m) => m.amt === 'kommunikation');
  if (!k) return 'regelmaessig';
  if (k.haltung >= B.social.frequenzOftAb) return 'oft';
  if (k.haltung <= B.social.frequenzSeltenBis) return 'selten';
  return 'regelmaessig';
}

/** Faktor auf Schnupperanfragen durch die Reichweite */
export function reichweiteFaktor(state: GameState): number {
  const S = B.social;
  return Math.max(0.5, 1 + (state.social.reichweite - S.eintrittBasis) * S.eintrittProPunkt);
}

/** Familien eines Teams ohne Foto-Einwilligung */
export function ohneEinwilligung(state: GameState, teamId: Id | null): Elternteil[] {
  const kinder = teamId ? teamKinder(state, teamId) : Object.values(state.kinder).filter((k) => k.status === 'aktiv');
  const res: Elternteil[] = [];
  const gesehen = new Set<Id>();
  for (const k of kinder) {
    const f = state.familien[k.familieId];
    if (!f || f.fotoEinwilligung || gesehen.has(f.id)) continue;
    gesehen.add(f.id);
    const e = state.eltern[f.elternIds[0] ?? ''];
    if (e) res.push(e);
  }
  return res;
}

function postsLetzteWochen(state: GameState, wochen: number): Post[] {
  const jetzt = absoluteWoche(state);
  return state.social.posts.filter((p) => jetzt - absoluteWoche(p) < wochen);
}

export function postsImMonat(state: GameState): number {
  return postsLetzteWochen(state, 4).length;
}

/** Veröffentlicht einen Post (Entscheid). Gibt ein betroffenes Elternteil zurück, falls Bilder ohne Einwilligung gezeigt wurden. */
export function postVeroeffentlichen(
  state: GameState,
  rng: Rng,
  typ: PostTyp,
  teamId: Id | null,
  bilder: Bildwahl,
  werbung: number,
  buchungen: Buchung[]
): { post: Post; betroffen: Elternteil | null } {
  const S = B.social;
  let basis: number = S.basis[typ];
  if (typ === 'matchbericht') {
    const team = teamId ? state.teams[teamId] : undefined;
    const spiel = !!team && (hatWettkampf(state, team, state.woche) || hatWettkampf(state, team, state.woche - 1));
    if (!spiel) basis = S.basis.matchberichtOhneSpiel;
  }
  if (typ === 'anlass') {
    const jetzt = absoluteWoche(state);
    const anlass = state.aktivitaeten.some((a) => a.status === 'abgeschlossen' && jetzt - a.abschluss <= 2);
    if (!anlass) basis = S.basis.anlassOhneAnlass;
  }
  const w = clamp(Math.round(werbung), 0, S.maxWerbung);
  if (w > 0) buchen(state, { kategorie: 'socialmedia', text: `Werbung für Post (${POST_NAMEN[typ]})`, betrag: -w }, buchungen);
  const gewinn = round1(basis * S.bilder[bilder] * S.frequenz[frequenz(state)] + (w / 50) * S.werbungPro50);
  state.social.reichweite = clamp(round1(state.social.reichweite + gewinn), 0, 100);
  state.verein.ruf = clamp(round1(state.verein.ruf + gewinn * S.rufFaktor), 0, 100);
  let betroffen: Elternteil | null = null;
  if (bilder === 'alle') {
    const ohne = ohneEinwilligung(state, teamId);
    if (ohne.length > 0 && rng.chance(S.problemWahrscheinlichkeit)) betroffen = rng.pick(ohne);
  }
  const post: Post = {
    id: neueId(state, 'p'),
    saison: state.saison,
    woche: state.woche,
    typ,
    teamId,
    bilder,
    werbung: w,
    reichweiteGewinn: gewinn,
    problem: !!betroffen
  };
  state.social.posts.push(post);
  if (state.social.posts.length > 200) state.social.posts = state.social.posts.slice(-200);
  return { post, betroffen };
}

/** Wöchentlicher Zerfall der Reichweite und Rückstellung des Rufs */
export function socialWoche(state: GameState): void {
  state.social.reichweite = clamp(round1(state.social.reichweite * (1 - B.social.zerfall)), 0, 100);
  // Der Ruf kehrt ohne neue Impulse langsam zur Mitte zurück
  state.verein.ruf = clamp(round1(state.verein.ruf + (50 - state.verein.ruf) * B.social.rufRueckstellung), 0, 100);
}
