// Datenmodell des Spielkerns. Alles hier muss vollständig JSON-serialisierbar sein
// (keine Klassen, keine Dates, keine Maps/Sets, keine Funktionen).

export type Id = string;

export type Geschlecht = 'w' | 'm';
export type Hautton = 'hell' | 'hell-mittel' | 'mittel' | 'mittel-dunkel' | 'dunkel';
export type PortraitGruppe = 'kind' | 'jugend' | 'jung' | 'erwachsen' | 'aelter';
export type Stimmung = 'froh' | 'neutral' | 'bedrueckt';

export type Stufe = 'U9' | 'U12' | 'U15' | 'U18';
export const STUFEN: readonly Stufe[] = ['U9', 'U12', 'U15', 'U18'] as const;

export type Phase = 'vorbereitung' | 'trainingsstart' | 'meisterschaft' | 'playoffs' | 'abschluss';

export interface PortraitMeta {
  gruppe: PortraitGruppe;
  geschlecht: Geschlecht;
  hautton: Hautton;
  /** Index in den Bildpool (wird mit dem Bildpool zugewiesen, 0 = noch keiner). */
  nummer: number;
}

/** Beziehung zu einer anderen Person (für spätere Etappen: Chemie, Freundschaften, Konflikte). */
export interface Beziehung {
  zielId: Id;
  art: 'familie' | 'freundschaft' | 'konflikt' | 'kollegial';
  /** −100 (feindlich) bis +100 (sehr eng) */
  staerke: number;
}

export interface PersonBasis {
  id: Id;
  vorname: string;
  nachname: string;
  geschlecht: Geschlecht;
  geburtsjahr: number;
  herkunft: string;
  portrait: PortraitMeta;
  charakterzuege: string[];
  beziehungen: Beziehung[];
  /** Vertrauen zur Spieler:in, −100 bis +100 (Etappe 2) */
  vertrauen: number;
  /** offenbarte verborgene Infos (Schlüssel aus dem Info-Katalog, z.B. 'typ', 'talent') */
  bekannt: string[];
  /** geführte Gespräche */
  gespraeche: GespraechEintrag[];
}

export interface GespraechEintrag {
  saison: number;
  woche: number;
  dialogId: string;
  titel: string;
  ergebnis: string;
  vertrauensAenderung: number;
}

export type Ton = 'empathisch' | 'sachlich' | 'bestimmt' | 'ausweichend';
export type HelferRolle = 'fahrdienst' | 'anlaesse';

export interface KindWerte {
  /** verborgen */
  talent: number;
  technik: number;
  kondition: number;
  spielverstaendnis: number;
  motivation: number;
  sozialverhalten: number;
  selbstvertrauen: number;
  /** für Etappe 2+ (Fairplay-Mechanik), wird schon generiert */
  fairplay: number;
}

export type KindStatus = 'aktiv' | 'schnupper' | 'ausgetreten';

export interface Zufriedenheitsfaktoren {
  trainerbeziehung: number;
  teamklima: number;
  spassEinsatz: number;
  entwicklung: number;
  elterneinfluss: number;
  rahmen: number;
}

export interface Kind extends PersonBasis {
  rolle: 'kind';
  werte: KindWerte;
  zufriedenheit: number;
  /** zuletzt berechnete Faktoren (für Anzeige) */
  faktoren: Zufriedenheitsfaktoren;
  /** einmalige Effekte (E), die in der nächsten Simulation verrechnet werden */
  offeneEffekte: number;
  /** zusätzliches einmaliges Austrittsrisiko für die nächste Simulation */
  austrittsRisikoZusatz: number;
  teamId: Id | null;
  familieId: Id;
  status: KindStatus;
  schnupperWochenRest: number;
  /** gleitender Schnitt 0–1 */
  einsatzzeit: number;
  /** gleitender Schnitt des wöchentlichen Fortschritts (Skillpunkte) */
  fortschritt: number;
  eintritt: { saison: number; woche: number };
  /** z.B. buddy (Gotti/Götti), für spätere Etappen erweiterbar */
  flags: Record<string, boolean>;
  austritt?: { saison: number; woche: number; grund: string };
}

export type ElternTyp =
  | 'engagiert'
  | 'ehrgeizig'
  | 'abwesend'
  | 'kritiker'
  | 'sponsor'
  | 'potenziellerTrainer';

export interface Elternteil extends PersonBasis {
  rolle: 'elternteil';
  typ: ElternTyp;
  engagement: number;
  konfliktbereitschaft: number;
  zahlungsmoral: number;
  einfluss: number;
  /** 0–100, Stimmung gegenüber dem Verein */
  stimmung: number;
  familieId: Id;
  /** Helfer-Rolle (Etappe 2) */
  helfer: HelferRolle | null;
  helferTeamId: Id | null;
  /** 0–100, Auslastung durch Helfereinsätze */
  auslastung: number;
}

export type Qualifikation = 'keine' | 'leiter' | 'leiterWeiterbildung' | 'experte';
export type TrainerRolle = 'haupttrainer' | 'cotrainer' | 'torhuetertrainer' | 'betreuer';
export const TRAINER_ROLLEN: readonly TrainerRolle[] = [
  'haupttrainer',
  'cotrainer',
  'torhuetertrainer',
  'betreuer'
] as const;

export interface TrainerSkills {
  organisation: number;
  kinderverstaendnis: number;
  fachwissen: number;
  erfahrung: number;
  torhueter: number;
}
export type TrainerSkill = keyof TrainerSkills;

export interface Trainer extends PersonBasis {
  rolle: 'trainer';
  skills: TrainerSkills;
  /** Trainings pro Woche, die die Person leisten kann */
  verfuegbarkeit: number;
  /** 0–100 */
  belastung: number;
  /** 1–20 */
  motivation: number;
  qualifikation: Qualifikation;
  quelle: 'eltern' | 'junior' | 'ehemalig' | 'aktiv' | 'inserat';
  status: 'aktiv' | 'zurueckgetreten';
  /** Kind-Id, falls die Person selbst Junior:in ist (Hilfsleiter:in) */
  kindId?: Id;
  /** Elternteil-Id, falls die Person ein Elternteil ist */
  elternteilId?: Id;
  absagenSaison: number;
}

// ---------- Vorstand (Etappe 3) ----------

export type Amt = 'praesidium' | 'kasse' | 'sportchef' | 'kommunikation' | 'beisitz';
export type Prioritaet = 'aktivmannschaft' | 'finanzen' | 'image' | 'junioren' | 'breitensport';

export interface Vorstandsmitglied extends PersonBasis {
  rolle: 'vorstand';
  amt: Amt;
  /** Haltung zu den Junioren, −100 (skeptisch) bis +100 (Unterstützer:in) */
  haltung: number;
  prioritaet: Prioritaet;
}

export type Person = Kind | Elternteil | Trainer | Vorstandsmitglied;

export interface Familie {
  id: Id;
  nachname: string;
  einkommen: 'tief' | 'mittel' | 'hoch';
  kinderIds: Id[];
  elternIds: Id[];
  haertefall: boolean;
  /** offene Beiträge in CHF (Etappe 2) */
  ausstand: number;
  /** zahlt zurzeit nicht */
  saeumig: boolean;
  ratenzahlung: boolean;
  /** Eltern leben getrennt */
  getrennt: boolean;
  /** Einwilligung für Bilder der Kinder in sozialen Medien (Etappe 3) */
  fotoEinwilligung: boolean;
}

export type Schwerpunkt = 'spass' | 'technik' | 'kondition' | 'taktik' | 'spielformen';

export interface Trainingsplan {
  trainingsProWoche: number;
  schwerpunkt: Schwerpunkt;
}

export interface TeamTrainer {
  trainerId: Id;
  rolle: TrainerRolle;
}

export interface Team {
  id: Id;
  name: string;
  stufe: Stufe;
  trainer: TeamTrainer[];
  plan: Trainingsplan;
  halle: string;
  absagenInFolge: number;
  absagenSaison: number;
  flags: Record<string, boolean>;
  /** Anzahl Elternabende in der laufenden Saison (Etappe 2) */
  elternabende: number;
}

export interface Buchung {
  saison: number;
  woche: number;
  kategorie:
    | 'beitraege'
    | 'hallenmiete'
    | 'material'
    | 'trainerentschaedigung'
    | 'anwerbung'
    | 'verbandsgebuehren'
    | 'vereinsbeitrag'
    | 'ereignis'
    | 'elternarbeit'
    | 'vorstand'
    | 'sponsoren'
    | 'anlaesse'
    | 'socialmedia';
  text: string;
  betrag: number;
}

export type Niveau = 'tief' | 'mittel' | 'hoch';

export interface Finanzen {
  kasse: number;
  beitraege: Record<Stufe, number>;
  /** Prozent Rabatt ab dem zweiten Kind einer Familie */
  geschwisterrabatt: number;
  haertefallfonds: boolean;
  material: Niveau;
  entschaedigung: Niveau;
  buchungen: Buchung[];
  wochenUnterNull: number;
}

export interface Verein {
  name: string;
  /** 0–100, für Etappe 3+ (Vorstand, Social Media) */
  ruf: number;
  /** 0–100, Einfluss im Vorstand, für Etappe 3 */
  vorstandEinfluss: number;
}

// ---------- Wettkampf ----------

export interface WettkampfTeam {
  id: Id;
  name: string;
  /** gesetzt, wenn es ein eigenes Team ist */
  eigenesTeamId?: Id;
  staerke: number;
}

export interface Spiel {
  woche: number;
  heimId: Id;
  gastId: Id;
  toreHeim: number;
  toreGast: number;
  /** Verlängerung/Penaltyschiessen (nur Playoffs/Finals) */
  nachVerlaengerung?: boolean;
  typ: 'turnier' | 'liga' | 'meisterschaft' | 'playoff' | 'finalturnier';
}

export interface U9Turniere {
  turnierWochen: number[];
  spiele: Spiel[];
  teilnehmer: WettkampfTeam[];
}

export interface Liga {
  stufe: 'U12' | 'U15';
  teams: WettkampfTeam[];
  turnierWochen: number[];
  finalWoche: number;
  spiele: Spiel[];
  finalTeilnehmer: Id[];
  finalRangliste: Id[];
}

export interface Serie {
  runde: 'viertelfinal' | 'halbfinal' | 'final';
  hoehergesetztId: Id;
  tiefergesetztId: Id;
  siegeHoeher: number;
  siegeTiefer: number;
  spiele: Spiel[];
  siegerId?: Id;
}

export interface Meisterschaft {
  teams: WettkampfTeam[];
  runden: { woche: number; paarungen: [Id, Id][] }[];
  spiele: Spiel[];
  playoffStartWoche: number;
  /** Rangfolge nach der Qualifikation (Seeds 1–8) */
  setzliste: Id[];
  playoffs: Serie[];
  meisterId?: Id;
}

export interface Wettkampf {
  gestartet: boolean;
  u9: U9Turniere;
  ligen: { U12: Liga; U15: Liga };
  u18: Meisterschaft;
}

// ---------- Ereignisse ----------

export type Beteiligte = Partial<Record<string, Id>>;

export interface EreignisInstanz {
  id: Id;
  vorlageId: string;
  saison: number;
  woche: number;
  titel: string;
  text: string;
  pflicht: boolean;
  beteiligte: Beteiligte;
  /** zusätzliche Textbausteine, z.B. {ferien} oder {anwesende} */
  variablen: Record<string, string>;
  /** Optionen, die zum Zeitpunkt der Auslösung wählbar sind */
  verfuegbareOptionen: string[];
  /** absolute Woche (über alle Saisons), ab der das Ereignis automatisch erledigt wird */
  ablaufWoche: number;
  erledigt?: { optionId: string; text: string };
}

export interface Nachricht {
  id: Id;
  saison: number;
  woche: number;
  absender: string;
  titel: string;
  text: string;
  gelesen: boolean;
  ereignisId?: Id;
  wichtig?: boolean;
}

export type TrainingsAnpassung = 'absagen' | 'zusammenlegen' | 'kleingruppe' | 'reduziert' | 'aussenplatz';

export interface SaisonBilanz {
  saison: number;
  mitgliederStart: number;
  mitgliederEnde: number;
  zufriedenheitSchnitt: number;
  eintritte: number;
  austritte: number;
  u18Abgaenger: number;
  uebertritte: number;
  kasseEnde: number;
  bewertung: number;
  titel: string;
  wettkampf: string[];
  /** Etappe 3: Bewertung nach allen Kriterien */
  endbewertung?: Endbewertung;
}

export type AntragTyp = 'budget' | 'neuesTeam' | 'trainerentschaedigung' | 'material' | 'hallenzeiten';

export interface Antrag {
  id: Id;
  typ: AntragTyp;
  betrag: number;
  saison: number;
  woche: number;
}

export interface AntragErgebnis {
  antrag: Antrag;
  stimmen: { mitgliedId: Id | 'spieler'; ja: boolean }[];
  angenommen: boolean;
}

export interface Sitzung {
  saison: number;
  woche: number;
  vorbereitung: number;
  ergebnisse: AntragErgebnis[];
  einflussVorher: number;
  einflussNachher: number;
}

export interface GvErgebnis {
  saison: number;
  jahresbudget: number;
  gewaehlt: boolean;
  stimmung: number;
  text: string;
}

export interface VorstandState {
  mitglieder: Record<Id, Vorstandsmitglied>;
  /** Spieler:in ist selbst im Vorstand gewählt und stimmt mit */
  spielerImVorstand: boolean;
  offeneAntraege: Antrag[];
  /** Vorbereitungspunkte für die nächste Sitzung */
  vorbereitung: number;
  sitzungen: Sitzung[];
  einflussVerlauf: { saison: number; woche: number; wert: number }[];
  /** von der GV beschlossenes Jahresbudget für die nächste Saison (wird in Woche 1 gebucht) */
  jahresbudget: number;
  gv: GvErgebnis[];
  /** Rabatt auf die Hallenmiete (0–1) für die laufende Saison */
  hallenRabatt: number;
  /** Konkurs-Kette: 0 = keine, 1 = Massnahmen verlangt, 2 = Kürzung, 3 = Absetzung */
  konkursStufe: number;
  rettungsplan: boolean;
  /** Kürzungsfaktor auf das nächste Jahresbudget (0–1) */
  kuerzung: number;
  /** Wochen in Folge ohne spielfähiges Team */
  wochenOhneTeam: number;
}

// ---------- Social Media, Sponsoren, Anlässe (Etappe 3) ----------

export type PostTyp = 'matchbericht' | 'training' | 'trainerportrait' | 'anlass';
export type Bildwahl = 'keine' | 'nurMitEinwilligung' | 'alle';

export interface Post {
  id: Id;
  saison: number;
  woche: number;
  typ: PostTyp;
  teamId: Id | null;
  bilder: Bildwahl;
  werbung: number;
  reichweiteGewinn: number;
  problem: boolean;
}

export interface SocialState {
  /** 0–100 */
  reichweite: number;
  posts: Post[];
}

export type Gegenleistung = 'logo' | 'socialmedia' | 'trikot';

export interface Sponsor {
  id: Id;
  name: string;
  branche: string;
  /** Betrag pro Saison in CHF */
  betrag: number;
  /** Laufzeit in Saisons */
  laufzeit: number;
  startSaison: number;
  gegenleistung: Gegenleistung;
  elternteilId?: Id;
  /** 0–100 */
  zufriedenheit: number;
  status: 'angebot' | 'aktiv' | 'beendet';
}

export interface LaufendeAktivitaet {
  id: Id;
  aktivitaetId: string;
  saison: number;
  startWoche: number;
  /** absolute Woche, in der die Aktivität stattfindet */
  abschluss: number;
  helferIds: Id[];
  status: 'laufend' | 'abgeschlossen';
  ertrag?: number;
  text?: string;
}

export interface ChronikEintrag {
  saison: number;
  woche: number;
  art: 'erfolg' | 'krise' | 'finanzen' | 'vorstand' | 'verein';
  text: string;
}

export interface Endbewertung {
  punkte: number;
  titel: string;
  kriterien: { id: string; name: string; gewicht: number; wert: number }[];
}

export interface Spielende {
  grund: 'laufzeit' | 'etappenEnde' | 'absetzung' | 'konkurs' | 'aufgeloest';
  endbewertung?: Endbewertung;
  punkte: number;
  titel: string;
  text: string;
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  /** aktueller Zustand des Zufallsgenerators */
  rngState: number;
  verein: Verein;
  /** 1-basiert */
  saison: number;
  /** Kalenderjahr, in dem die erste Saison beginnt (Juni) */
  startJahr: number;
  /** 1–52, die als nächstes zu simulierende Woche */
  woche: number;
  laufzeit: number;
  kinder: Record<Id, Kind>;
  eltern: Record<Id, Elternteil>;
  trainer: Record<Id, Trainer>;
  familien: Record<Id, Familie>;
  teams: Record<Id, Team>;
  finanzen: Finanzen;
  wettkampf: Wettkampf;
  ereignisse: EreignisInstanz[];
  posteingang: Nachricht[];
  /** Trainingsanpassungen aus Ereignissen für die kommende Woche */
  trainingsAnpassungen: Record<Id, TrainingsAnpassung>;
  /** Team-Id → Team, mit dem in der kommenden Woche zusammengelegt wird */
  zusammenlegungen: Record<Id, Id>;
  /** Wochen der zuletzt ausgelösten Ereignisse pro Vorlage (Abkühlzeit) */
  ereignisVerlauf: Record<string, number>;
  bilanzen: SaisonBilanz[];
  saisonStatistik: { mitgliederStart: number; eintritte: number; austritte: number };
  naechsteId: number;
  spielende?: Spielende;
  /** Etappe 3 */
  vorstand: VorstandState;
  social: SocialState;
  sponsoren: Sponsor[];
  aktivitaeten: LaufendeAktivitaet[];
  chronik: ChronikEintrag[];
  /** Lernmodus: kein vorzeitiges Spielende */
  lernmodus: boolean;
  /** Woche (absolut), bis zu der eine aktive Sponsorensuche wirkt */
  sponsorSucheBis: number;
  /** Platzhalter für spätere Etappen (Vorstand, Social Media, J+S, Fallakten) */
  erweiterungen: Record<string, unknown>;
}

// ---------- Entscheide ----------

export type Entscheid =
  | { typ: 'trainerZuteilen'; trainerId: Id; teamId: Id; rolle: TrainerRolle }
  | { typ: 'trainerEntfernen'; trainerId: Id; teamId: Id }
  | { typ: 'trainingsplan'; teamId: Id; plan: Trainingsplan }
  | { typ: 'kindVerschieben'; kindId: Id; teamId: Id }
  | { typ: 'teamGruenden'; stufe: Stufe }
  | { typ: 'teamAufloesen'; teamId: Id }
  | { typ: 'kinderAufteilen'; stufe: Stufe }
  | { typ: 'anwerbung'; massnahmeId: string; zielStufe?: Stufe }
  | { typ: 'beitrag'; stufe: Stufe; betrag: number }
  | { typ: 'geschwisterrabatt'; prozent: number }
  | { typ: 'haertefallfonds'; aktiv: boolean }
  | { typ: 'material'; niveau: Niveau }
  | { typ: 'entschaedigung'; niveau: Niveau }
  | { typ: 'ereignis'; ereignisId: Id; optionId: string }
  | { typ: 'dialog'; dialogId: string; personId: Id; antworten: string[]; ereignisId?: Id }
  | { typ: 'elternabend'; teamId: Id }
  | { typ: 'helferBeenden'; elternteilId: Id }
  | { typ: 'antrag'; antragTyp: AntragTyp; betrag: number }
  | { typ: 'antragZurueckziehen'; antragId: Id }
  | { typ: 'sitzungVorbereiten' }
  | { typ: 'aktivitaet'; aktivitaetId: string }
  | { typ: 'post'; postTyp: PostTyp; teamId: Id | null; bilder: Bildwahl; werbung: number }
  | { typ: 'sponsorSuche' };

// ---------- Ergebnis einer Woche ----------

export interface WochenBericht {
  saison: number;
  woche: number;
  datum: string;
  phase: Phase;
  ferien: string | null;
  mitgliederVorher: number;
  mitgliederNachher: number;
  zufriedenheitVorher: number;
  zufriedenheitNachher: number;
  kasseVorher: number;
  kasseNachher: number;
  buchungen: Buchung[];
  eintritte: { id: Id; name: string; text: string }[];
  austritte: { id: Id; name: string; grund: string }[];
  schnupper: { id: Id; name: string }[];
  spiele: { stufe: Stufe; text: string }[];
  trainings: { teamId: Id; text: string }[];
  meldungen: string[];
  fehler: string[];
  saisonBilanz?: SaisonBilanz;
}

export interface WochenErgebnis {
  state: GameState;
  events: EreignisInstanz[];
  report: WochenBericht;
}
