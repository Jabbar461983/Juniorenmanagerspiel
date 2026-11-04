// Sponsoren (Etappe 3): Angebote, Verträge, Gegenleistungen.
import { B, SPONSOR_FIRMEN } from './config';
import { buchen } from './finanzen';
import { postsImMonat } from './social';
import type { Rng } from './rng';
import type { Buchung, GameState, Gegenleistung, Id, Sponsor } from './types';
import { clamp, neueId } from './util';
import { chronik } from './vorstand';
import { absoluteWoche } from './kalender';

export const GEGENLEISTUNG_NAMEN: Record<Gegenleistung, string> = {
  logo: 'Logo auf der Website und an der Bande',
  socialmedia: `mindestens ${B.sponsoren.socialPostsProMonat} Social-Media-Posts pro Monat`,
  trikot: 'Logo auf den Trikots'
};

/** Wöchentliche Wahrscheinlichkeit einer Sponsorenanfrage */
export function anfrageWahrscheinlichkeit(state: GameState): number {
  const S = B.sponsoren;
  let p = S.anfrageBasis + state.social.reichweite * S.anfrageReichweite + state.verein.ruf * S.anfrageRuf;
  if (state.sponsorSucheBis >= absoluteWoche(state)) p *= S.sucheFaktor;
  // Der lokale Markt ist begrenzt: Jeder laufende Vertrag senkt die Chance auf neue Anfragen
  p *= Math.pow(S.marktSaettigung, aktiveSponsoren(state).length);
  return clamp(p, 0, 0.5);
}

export function aktiveSponsoren(state: GameState): Sponsor[] {
  return state.sponsoren.filter((s) => s.status === 'aktiv');
}

/** Benötigte Posts pro Monat aus allen Social-Media-Gegenleistungen */
export function benoetigtePosts(state: GameState): number {
  return aktiveSponsoren(state).filter((s) => s.gegenleistung === 'socialmedia').length * B.sponsoren.socialPostsProMonat;
}

/** Erzeugt ein Sponsorenangebot (Status «angebot»). */
export function sponsorAngebot(state: GameState, rng: Rng, elternteilId?: Id): Sponsor {
  const S = B.sponsoren;
  const vergeben = new Set(state.sponsoren.filter((s) => s.status !== 'beendet').map((s) => s.name));
  const frei = SPONSOR_FIRMEN.filter((f) => !vergeben.has(f.name));
  const firma = elternteilId
    ? { name: `Firma ${state.eltern[elternteilId]?.nachname ?? ''}`.trim(), branche: 'Familienunternehmen' }
    : rng.pick(frei.length ? frei : SPONSOR_FIRMEN);
  const [min, max] = S.betrag as [number, number];
  const faktor = clamp(1 + (state.social.reichweite + state.verein.ruf - 70) / 100, 0.6, 1.6);
  const betrag = Math.round((rng.int(min, max) * faktor) / 100) * 100;
  const s: Sponsor = {
    id: neueId(state, 's'),
    name: firma.name,
    branche: firma.branche,
    betrag,
    laufzeit: rng.int(S.laufzeit[0]!, S.laufzeit[1]!),
    startSaison: state.saison,
    gegenleistung: rng.pick(['logo', 'socialmedia', 'trikot'] as Gegenleistung[]),
    zufriedenheit: S.zufriedenheitStart,
    status: 'angebot',
    ...(elternteilId ? { elternteilId } : {})
  };
  state.sponsoren.push(s);
  return s;
}

export function sponsorAnnehmen(state: GameState, s: Sponsor, buchungen: Buchung[], meldungen: string[]): void {
  if (s.status !== 'angebot') return;
  s.status = 'aktiv';
  s.startSaison = state.saison;
  buchen(state, { kategorie: 'sponsoren', text: `Sponsoring ${s.name}`, betrag: s.betrag }, buchungen);
  meldungen.push(`Neuer Sponsor: ${s.name} (CHF ${s.betrag} pro Saison, ${s.laufzeit} Saison${s.laufzeit === 1 ? '' : 's'}).`);
  chronik(state, 'finanzen', `Sponsoringvertrag mit ${s.name} über CHF ${s.betrag} pro Saison.`);
}

export function sponsorAblehnen(s: Sponsor): void {
  if (s.status === 'angebot') s.status = 'beendet';
}

/** Wöchentlich: Zufriedenheit mit der Gegenleistung; Interessenkonflikt bei Eltern-Sponsoren. */
export function sponsorenWoche(state: GameState): void {
  const S = B.sponsoren;
  for (const s of state.sponsoren) {
    if (s.status !== 'aktiv') continue;
    if (s.gegenleistung === 'socialmedia') {
      s.zufriedenheit = clamp(s.zufriedenheit + (postsImMonat(state) >= benoetigtePosts(state) ? 1 : -S.zufriedenheitVerlustWoche), 0, 100);
    } else {
      s.zufriedenheit = clamp(s.zufriedenheit + (state.verein.ruf >= 50 ? 0.5 : -1), 0, 100);
    }
    if (s.elternteilId) {
      // Bevorzugung: Ohne transparente Einsatzregeln murren andere Eltern
      const e = state.eltern[s.elternteilId];
      const kind = e ? state.familien[e.familieId]?.kinderIds.map((id) => state.kinder[id]).find((k) => k?.teamId && k.status === 'aktiv') : undefined;
      const team = kind?.teamId ? state.teams[kind.teamId] : undefined;
      if (team && !team.flags['einsatzregeln']) {
        for (const k of Object.values(state.kinder)) {
          if (k.teamId !== team.id || k.familieId === kind!.familieId || k.status !== 'aktiv') continue;
          for (const eid of state.familien[k.familieId]?.elternIds ?? []) {
            const andere = state.eltern[eid];
            if (andere) andere.stimmung = clamp(andere.stimmung - 0.2, 0, 100);
          }
        }
      }
    }
  }
}

/** Saisonstart: Zahlungen laufender Verträge, Verlängerung oder Ende. */
export function sponsorenSaisonstart(state: GameState, buchungen: Buchung[], meldungen: string[]): void {
  for (const s of state.sponsoren) {
    if (s.status !== 'aktiv') continue;
    const jahre = state.saison - s.startSaison;
    if (jahre >= s.laufzeit) {
      if (s.zufriedenheit >= B.sponsoren.verlaengerungAb) {
        s.startSaison = state.saison;
        meldungen.push(`${s.name} verlängert das Sponsoring um ${s.laufzeit} Saison${s.laufzeit === 1 ? '' : 's'}.`);
      } else {
        s.status = 'beendet';
        meldungen.push(`${s.name} beendet das Sponsoring – die Gegenleistung hat nicht überzeugt.`);
        continue;
      }
    }
    buchen(state, { kategorie: 'sponsoren', text: `Sponsoring ${s.name}`, betrag: s.betrag }, buchungen);
  }
}
