// Zentraler Zugriff auf Balancing-Werte und Inhalte. Der Spielkern liest
// Konstanten ausschliesslich von hier.
import balancing from '../content/balancing.json';
import ferien from '../content/ferien.json';
import anwerbung from '../content/anwerbung.json';
import gegner from '../content/gegner.json';
import namen from '../content/namen.json';
import charakterzuege from '../content/charakterzuege.json';
import ereignisse from '../content/ereignisse.json';
import type { ElternTyp, Phase, Schwerpunkt, Stufe } from './types';

export const B = balancing;
export type Balancing = typeof balancing;

export interface FerienDef {
  id: string;
  name: string;
  von: string;
  bis: string;
  abwesenheitKinder: number;
  abwesenheitTrainer: number;
}
export const FERIEN: FerienDef[] = ferien.ferien;
export const FERIEN_REGION: string = ferien.region;

export interface AnwerbungDef {
  id: string;
  name: string;
  beschreibung: string;
  kosten: number;
  reichweite: number[];
  alter: number[];
  zielStufeWaehlbar: boolean;
}
export const ANWERBUNG: AnwerbungDef[] = anwerbung.massnahmen;

export const GEGNER_VEREINE: string[] = gegner.vereine;
export const HALLEN: string[] = gegner.hallen;

export interface HerkunftDef {
  id: string;
  gewicht: number;
  hautton: Record<string, number>;
  w: string[];
  m: string[];
  nachnamen: string[];
}
export const HERKUENFTE = namen.herkuenfte as unknown as HerkunftDef[];

export interface KindZugDef {
  id: string;
  name: string;
  beschreibung: string;
  faktoren: Partial<Record<string, number>>;
  teamklima?: number;
  negativFaktor?: number;
  einsatzSensibel?: number;
  kinderverstaendnisSensibel?: number;
  siegSensibel?: number;
  aufhebendesFlag?: string;
}
export const KIND_ZUEGE: KindZugDef[] = charakterzuege.kinder;

export interface TrainerZugDef {
  id: string;
  name: string;
  beschreibung: string;
  absageFaktor?: number;
  kinderverstaendnis?: number;
  organisation?: number;
  fachwissen?: number;
  spass?: number;
}
export const TRAINER_ZUEGE: TrainerZugDef[] = charakterzuege.trainer;
export const ELTERN_ZUEGE: { id: string; name: string }[] = charakterzuege.eltern;

export interface ElternTypDef {
  id: ElternTyp;
  name: string;
  gewicht: number;
  basis: number;
  einsatzAbhaengig?: number;
  beschreibung: string;
}
export const ELTERN_TYPEN = charakterzuege.elternTypen as ElternTypDef[];

export function kindZug(id: string): KindZugDef | undefined {
  return KIND_ZUEGE.find((z) => z.id === id);
}
export function trainerZug(id: string): TrainerZugDef | undefined {
  return TRAINER_ZUEGE.find((z) => z.id === id);
}
export function elternTyp(id: ElternTyp): ElternTypDef {
  const t = ELTERN_TYPEN.find((e) => e.id === id);
  if (!t) throw new Error(`Unbekannter Elterntyp ${id}`);
  return t;
}

export function stufeConfig(stufe: Stufe) {
  return B.stufen[stufe];
}

export function schwerpunktConfig(s: Schwerpunkt) {
  return B.schwerpunkte[s];
}

// ---------- Ereignisvorlagen ----------

export interface Bedingung {
  typ: 'beteiligterWert' | 'trainerZug' | 'teamFlag' | 'materialNiveau' | 'schwerpunkt';
  rolle?: string;
  wert?: string;
  ab?: number;
  zug?: string;
  flag?: string;
  niveau?: string;
  schwerpunkt?: string;
  faktor: number;
}

export interface Effekt {
  typ: string;
  ziel?: string;
  rolle?: string;
  wert?: number | boolean;
  text?: string;
  aktion?: string;
  flag?: string;
  anzahl?: number[];
  alter?: number[];
  talent?: number[];
  team?: string;
  von?: string;
  zu?: string;
  wahrscheinlichkeit?: number;
  dann?: Effekt[];
  sonst?: Effekt[];
}

export interface BeteiligterDef {
  rolle: string;
  art: 'team' | 'trainer' | 'kind' | 'elternteil';
  auswahl: string;
  aus?: string;
  optional?: boolean;
}

export interface OptionDef {
  id: string;
  text: string;
  benoetigt?: string[];
  benoetigtPlatz?: string;
  effekte: Effekt[];
  folge: string;
}

export interface EreignisVorlage {
  id: string;
  titel: string;
  absender: string;
  kategorie: string;
  text: string;
  pflicht: boolean;
  ausloeser: {
    wahrscheinlichkeit: number;
    abkuehlung?: number;
    phasen?: Phase[];
    ferien?: 'nur' | 'nie';
    proTeam?: boolean;
    modifikatoren?: Bedingung[];
  };
  beteiligte: BeteiligterDef[];
  optionen: OptionDef[];
  standardOption: string;
}

export const EREIGNIS_VORLAGEN = ereignisse.vorlagen as unknown as EreignisVorlage[];

export function ereignisVorlage(id: string): EreignisVorlage {
  const v = EREIGNIS_VORLAGEN.find((e) => e.id === id);
  if (!v) throw new Error(`Unbekannte Ereignisvorlage ${id}`);
  return v;
}
