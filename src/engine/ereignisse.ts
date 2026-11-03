// Datengetriebene Ereignisse: Auslösung, Beteiligte, Optionen und Effekte.
//
// Vorlagen liegen in src/content/ereignisse.json. Unterstützt werden:
//
// Auswahl von Beteiligten (art → auswahl):
//   team:       beliebig | mitTraining | mitZweiTrainern | ferienLuecke | wettkampfteam
//               | anderesTeam (aus) | nachbarstufe (aus) | vonKind (aus) | stufe:U15,U18
//   trainer:    imTeam (aus) | zweiterImTeam (aus) | ausAnderemTeam (aus) | belastet | beliebig
//   kind:       imTeam (aus) | u18Hilfsleiter | mitElternTyp:<typ> (aus optional) | tiefesEinkommen
//               | mitZugOhneFlag:<zug>:<flag> | vonElternteil (aus) | beliebig
//   elternteil: vonKind (aus) | vonKindTyp:<typ> (aus) | typ:<typ>
//
// Modifikatoren (Faktor auf Wahrscheinlichkeit): beteiligterWert, trainerZug, teamFlag,
//   materialNiveau, schwerpunkt
//
// Effekte: zufriedenheit, motivation, austrittsRisiko (ziel: kind | teamKinder | familieKinder |
//   andereKinderImTeam | alleKinder), elternStimmung (ziel: elternteil | teamEltern |
//   andereElternImTeam | familieEltern), trainerBelastung, trainerMotivation (ziel: Rolle oder
//   trainerVon:<teamrolle>), kasse, ruf, teamFlag, kindFlag, training, schnupperKinder,
//   neuesKind, elternZuTrainer, beziehung, familieHaertefall, zufall
import { B, EREIGNIS_VORLAGEN, ereignisVorlage, type Bedingung, type BeteiligterDef, type Effekt, type EreignisVorlage } from './config';
import { buchen } from './finanzen';
import { erzeugeKindMitFamilie, trainerAusElternteil } from './generator';
import { absoluteWoche, aktuelleWoche, type WochenInfo } from './kalender';
import {
  aktiveKinder,
  aktiveTrainer,
  alter,
  name,
  passendesTeam,
  stufeFuerAlter,
  teamKinder,
  teamTrainer
} from './personen';
import type { Rng } from './rng';
import type { Beteiligte, Buchung, EreignisInstanz, GameState, Id, Kind, Team, TrainingsAnpassung } from './types';
import { STUFEN } from './types';
import { negativFaktor } from './zufriedenheit';
import { hatWettkampf } from './wettkampf';
import { clamp, neueId } from './util';

export interface EreignisKontext {
  info: WochenInfo;
  /** erwartete Anzahl Kinder pro Team in der kommenden Woche */
  erwarteteAnwesende: Record<Id, number>;
}

// ---------- Beteiligte auswählen ----------

function kandidaten(state: GameState, def: BeteiligterDef, gebunden: Beteiligte, ctx: EreignisKontext): Id[] {
  const [auswahl, param, param2] = def.auswahl.split(':') as [string, string | undefined, string | undefined];
  const aus = def.aus ? gebunden[def.aus] : undefined;
  if (def.aus && !aus) return [];
  const teams = Object.values(state.teams);
  const mitKindern = (t: Team) => teamKinder(state, t.id).length > 0;

  switch (def.art) {
    case 'team': {
      switch (auswahl) {
        case 'beliebig':
          return teams.filter(mitKindern).map((t) => t.id);
        case 'mitTraining':
          return teams
            .filter((t) => mitKindern(t) && t.plan.trainingsProWoche > 0 && !state.trainingsAnpassungen[t.id] && teamTrainer(state, t).length > 0)
            .map((t) => t.id);
        case 'mitZweiTrainern':
          return teams.filter((t) => teamTrainer(state, t).length >= 2).map((t) => t.id);
        case 'ferienLuecke':
          return teams
            .filter(
              (t) =>
                mitKindern(t) &&
                t.plan.trainingsProWoche > 0 &&
                !state.trainingsAnpassungen[t.id] &&
                (ctx.erwarteteAnwesende[t.id] ?? 99) < B.stufen[t.stufe].idealMin
            )
            .map((t) => t.id);
        case 'wettkampfteam':
          return teams.filter((t) => mitKindern(t) && hatWettkampf(state, t, ctx.info.woche)).map((t) => t.id);
        case 'anderesTeam':
          return teams.filter((t) => t.id !== aus && mitKindern(t) && teamTrainer(state, t).length > 0).map((t) => t.id);
        case 'nachbarstufe': {
          const basis = state.teams[aus!];
          if (!basis) return [];
          const idx = STUFEN.indexOf(basis.stufe);
          return teams
            .filter((t) => t.id !== aus && mitKindern(t) && Math.abs(STUFEN.indexOf(t.stufe) - idx) <= 1)
            .map((t) => t.id);
        }
        case 'vonKind': {
          const k = state.kinder[aus!];
          return k?.teamId ? [k.teamId] : [];
        }
        case 'stufe': {
          const erlaubt = (param ?? '').split(',');
          return teams.filter((t) => mitKindern(t) && erlaubt.includes(t.stufe)).map((t) => t.id);
        }
      }
      return [];
    }
    case 'trainer': {
      const team = aus ? state.teams[aus] : undefined;
      switch (auswahl) {
        case 'imTeam': {
          if (!team) return [];
          const haupt = team.trainer.find((t) => t.rolle === 'haupttrainer' && state.trainer[t.trainerId]?.status === 'aktiv');
          return teamTrainer(state, team)
            .map((t) => t.id)
            .sort((a, b) => (a === haupt?.trainerId ? -1 : b === haupt?.trainerId ? 1 : 0));
        }
        case 'zweiterImTeam': {
          if (!team) return [];
          return teamTrainer(state, team)
            .map((t) => t.id)
            .filter((id) => !Object.values(gebunden).includes(id));
        }
        case 'ausAnderemTeam':
          if (!team) return [];
          return aktiveTrainer(state)
            .filter((t) => !team.trainer.some((tt) => tt.trainerId === t.id) && !Object.values(gebunden).includes(t.id))
            .map((t) => t.id);
        case 'belastet':
          return aktiveTrainer(state)
            .filter((t) => t.belastung >= 75)
            .map((t) => t.id);
        case 'beliebig':
          return aktiveTrainer(state).map((t) => t.id);
      }
      return [];
    }
    case 'kind': {
      const team = aus ? state.teams[aus] : undefined;
      const basis = team ? teamKinder(state, team.id, false) : aktiveKinder(state);
      switch (auswahl) {
        case 'imTeam':
        case 'beliebig':
          return basis.map((k) => k.id);
        case 'u18Hilfsleiter':
          return aktiveKinder(state)
            .filter((k) => alter(state, k) >= 16 && k.werte.motivation >= 10)
            .map((k) => k.id);
        case 'mitElternTyp':
          return basis
            .filter((k) => (state.familien[k.familieId]?.elternIds ?? []).some((e) => state.eltern[e]?.typ === param))
            .map((k) => k.id);
        case 'tiefesEinkommen':
          return aktiveKinder(state)
            .filter((k) => {
              const f = state.familien[k.familieId];
              return f && f.einkommen === 'tief' && !f.haertefall && !state.finanzen.haertefallfonds;
            })
            .map((k) => k.id);
        case 'mitZugOhneFlag':
          return aktiveKinder(state)
            .filter((k) => k.charakterzuege.includes(param ?? '') && !k.flags[param2 ?? ''])
            .map((k) => k.id);
        case 'vonElternteil': {
          const e = state.eltern[aus!];
          const f = e ? state.familien[e.familieId] : undefined;
          return (f?.kinderIds ?? []).filter((id) => state.kinder[id]?.status === 'aktiv' && state.kinder[id]?.teamId);
        }
      }
      return [];
    }
    case 'elternteil': {
      const kind = aus ? state.kinder[aus] : undefined;
      switch (auswahl) {
        case 'vonKind':
          return kind ? [...(state.familien[kind.familieId]?.elternIds ?? [])] : [];
        case 'vonKindTyp':
          return kind ? (state.familien[kind.familieId]?.elternIds ?? []).filter((e) => state.eltern[e]?.typ === param) : [];
        case 'typ': {
          const trainerEltern = new Set(Object.values(state.trainer).map((t) => t.elternteilId));
          return Object.values(state.eltern)
            .filter(
              (e) =>
                e.typ === param &&
                !trainerEltern.has(e.id) &&
                (state.familien[e.familieId]?.kinderIds ?? []).some((k) => state.kinder[k]?.status === 'aktiv')
            )
            .map((e) => e.id);
        }
      }
      return [];
    }
  }
}

function bindeBeteiligte(
  state: GameState,
  rng: Rng,
  vorlage: EreignisVorlage,
  ctx: EreignisKontext,
  festesTeam?: Id
): Beteiligte | null {
  const gebunden: Beteiligte = {};
  for (const def of vorlage.beteiligte) {
    let liste = kandidaten(state, def, gebunden, ctx);
    if (def.rolle === 'team' && festesTeam) liste = liste.includes(festesTeam) ? [festesTeam] : [];
    if (liste.length === 0) {
      if (def.optional) continue;
      return null;
    }
    // Haupttrainer:in bevorzugt (erste Stelle), sonst Zufall
    gebunden[def.rolle] = def.auswahl === 'imTeam' && def.art === 'trainer' && rng.chance(0.6) ? liste[0] : rng.pick(liste);
  }
  return gebunden;
}

function modifikator(state: GameState, b: Bedingung, gebunden: Beteiligte): number {
  const id = b.rolle ? gebunden[b.rolle] : undefined;
  switch (b.typ) {
    case 'beteiligterWert': {
      if (!id || !b.wert) return 1;
      const p = (state.trainer[id] ?? state.kinder[id] ?? state.eltern[id]) as unknown as Record<string, unknown> | undefined;
      const v = p?.[b.wert];
      return typeof v === 'number' && v >= (b.ab ?? 0) ? b.faktor : 1;
    }
    case 'trainerZug':
      return id && state.trainer[id]?.charakterzuege.includes(b.zug ?? '') ? b.faktor : 1;
    case 'teamFlag':
      return id && state.teams[id]?.flags[b.flag ?? ''] ? b.faktor : 1;
    case 'materialNiveau':
      return state.finanzen.material === b.niveau ? b.faktor : 1;
    case 'schwerpunkt':
      return id && state.teams[id]?.plan.schwerpunkt === b.schwerpunkt ? b.faktor : 1;
  }
  return 1;
}

// ---------- Text ----------

export function ersetzePlatzhalter(state: GameState, text: string, beteiligte: Beteiligte, variablen: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z0-9]+)(?:\.([a-zA-Z]+))?\}/g, (voll, rolle: string, feld?: string) => {
    if (variablen[rolle] !== undefined && !feld) return variablen[rolle]!;
    const id = beteiligte[rolle];
    if (!id) return voll;
    const team = state.teams[id];
    if (team) return feld === 'halle' ? team.halle : team.name;
    const p = state.kinder[id] ?? state.trainer[id] ?? state.eltern[id];
    if (!p) return '(unbekannt)';
    return feld === 'vorname' ? p.vorname : name(p);
  });
}

function verfuegbareOptionen(state: GameState, vorlage: EreignisVorlage, beteiligte: Beteiligte): string[] {
  return vorlage.optionen
    .filter((o) => (o.benoetigt ?? []).every((r) => !!beteiligte[r]))
    .filter((o) => {
      if (!o.benoetigtPlatz) return true;
      const team = state.teams[beteiligte[o.benoetigtPlatz] ?? ''];
      return !!team && team.trainer.length < B.trainer.maxTeamgroesse;
    })
    .map((o) => o.id);
}

export function erstelleInstanz(
  state: GameState,
  vorlage: EreignisVorlage,
  beteiligte: Beteiligte,
  variablen: Record<string, string>
): EreignisInstanz {
  const optionen = verfuegbareOptionen(state, vorlage, beteiligte);
  const inst: EreignisInstanz = {
    id: neueId(state, 'ev'),
    vorlageId: vorlage.id,
    saison: state.saison,
    woche: state.woche,
    titel: vorlage.titel,
    text: ersetzePlatzhalter(state, vorlage.text, beteiligte, variablen),
    pflicht: vorlage.pflicht,
    beteiligte,
    variablen,
    verfuegbareOptionen: optionen.length > 0 ? optionen : [vorlage.standardOption],
    ablaufWoche: absoluteWoche(state) + B.ereignisse.ablaufWochen
  };
  state.ereignisse.push(inst);
  state.posteingang.push({
    id: neueId(state, 'n'),
    saison: state.saison,
    woche: state.woche,
    absender: ersetzePlatzhalter(state, vorlage.absender, beteiligte, variablen),
    titel: vorlage.titel,
    text: inst.text,
    gelesen: false,
    ereignisId: inst.id,
    wichtig: vorlage.pflicht
  });
  return inst;
}

/** Löst für die anstehende Woche (state.woche) neue Ereignisse aus. */
export function erzeugeEreignisse(state: GameState, rng: Rng, ctx: EreignisKontext): EreignisInstanz[] {
  const neu: EreignisInstanz[] = [];
  const max = B.ereignisse.maxProWoche;
  const jetzt = absoluteWoche(state);
  // Pflicht-Ereignisse aus Ferien zählen nicht gegen das Maximum
  for (const vorlage of EREIGNIS_VORLAGEN) {
    const a = vorlage.ausloeser;
    if (a.phasen && !a.phasen.includes(ctx.info.phase)) continue;
    if (a.ferien === 'nur' && !ctx.info.ferien) continue;
    if (a.ferien === 'nie' && ctx.info.ferien) continue;
    const letzte = state.ereignisVerlauf[vorlage.id];
    const abkuehlung = a.abkuehlung ?? B.ereignisse.standardAbkuehlung;
    if (letzte !== undefined && abkuehlung > 0 && jetzt - letzte < abkuehlung) continue;

    const variablen: Record<string, string> = {};
    if (ctx.info.ferien) variablen['ferien'] = ctx.info.ferien.name;

    if (a.proTeam) {
      for (const team of Object.values(state.teams)) {
        const b = bindeBeteiligte(state, rng, vorlage, ctx, team.id);
        if (!b) continue;
        let p = a.wahrscheinlichkeit;
        for (const m of a.modifikatoren ?? []) p *= modifikator(state, m, b);
        if (!rng.chance(clamp(p, 0, 1))) continue;
        const v = { ...variablen, anwesende: String(Math.round(ctx.erwarteteAnwesende[team.id] ?? 0)) };
        neu.push(erstelleInstanz(state, vorlage, b, v));
        state.ereignisVerlauf[vorlage.id] = jetzt;
      }
      continue;
    }

    if (neu.filter((e) => e.vorlageId !== 'ferien_abwesenheit').length >= max) continue;
    // Wahrscheinlichkeit zuerst prüfen, dann Beteiligte binden
    const b = bindeBeteiligte(state, rng, vorlage, ctx);
    if (!b) continue;
    let p = a.wahrscheinlichkeit;
    for (const m of a.modifikatoren ?? []) p *= modifikator(state, m, b);
    if (!rng.chance(clamp(p, 0, 1))) continue;
    neu.push(erstelleInstanz(state, vorlage, b, variablen));
    state.ereignisVerlauf[vorlage.id] = jetzt;
  }
  return neu;
}

// ---------- Effekte ----------

export interface EffektKontext {
  buchungen: Buchung[];
  meldungen: string[];
  /** in dieser Woche neu angemeldete Schnupperkinder */
  schnupper: Kind[];
}

function kinderZiel(state: GameState, ziel: string, b: Beteiligte, rolle?: string, teamRolle = 'team'): Kind[] {
  const kind = state.kinder[b[rolle ?? 'kind'] ?? ''];
  const team = state.teams[b[teamRolle] ?? ''];
  const aktiv = (k: Kind | undefined): k is Kind => !!k && k.status !== 'ausgetreten';
  switch (ziel) {
    case 'kind':
      return aktiv(kind) ? [kind] : [];
    case 'teamKinder':
      return team ? teamKinder(state, team.id) : [];
    case 'familieKinder':
      return kind ? (state.familien[kind.familieId]?.kinderIds ?? []).map((id) => state.kinder[id]).filter(aktiv) : [];
    case 'andereKinderImTeam':
      return team ? teamKinder(state, team.id).filter((k) => !kind || k.familieId !== kind.familieId) : [];
    case 'alleKinder':
      return aktiveKinder(state);
  }
  return [];
}

function elternZiel(state: GameState, ziel: string, b: Beteiligte) {
  const e = state.eltern[b['elternteil'] ?? ''];
  const kind = state.kinder[b['kind'] ?? ''];
  const team = state.teams[b['team'] ?? ''];
  const elternVon = (kinder: Kind[]) => {
    const ids = new Set<Id>();
    for (const k of kinder) for (const id of state.familien[k.familieId]?.elternIds ?? []) ids.add(id);
    return [...ids].map((id) => state.eltern[id]!).filter(Boolean);
  };
  switch (ziel) {
    case 'elternteil':
      return e ? [e] : [];
    case 'teamEltern':
      return team ? elternVon(teamKinder(state, team.id)) : [];
    case 'andereElternImTeam': {
      const famId = kind?.familieId ?? e?.familieId;
      return team ? elternVon(teamKinder(state, team.id)).filter((x) => x.familieId !== famId) : [];
    }
    case 'familieEltern': {
      const famId = kind?.familieId ?? e?.familieId;
      return famId ? (state.familien[famId]?.elternIds ?? []).map((id) => state.eltern[id]!).filter(Boolean) : [];
    }
  }
  return [];
}

function trainerZiel(state: GameState, ziel: string, b: Beteiligte) {
  if (ziel.startsWith('trainerVon:')) {
    const team = state.teams[b[ziel.slice('trainerVon:'.length)] ?? ''];
    return team ? teamTrainer(state, team) : [];
  }
  const t = state.trainer[b[ziel] ?? ''];
  return t && t.status === 'aktiv' ? [t] : [];
}

export function wendeEffekteAn(
  state: GameState,
  rng: Rng,
  effekte: Effekt[],
  b: Beteiligte,
  ctx: EffektKontext
): void {
  for (const e of effekte) {
    const wert = typeof e.wert === 'number' ? e.wert : 0;
    switch (e.typ) {
      case 'zufriedenheit':
        for (const k of kinderZiel(state, e.ziel ?? 'kind', b, e.rolle, e.team)) {
          k.offeneEffekte += wert < 0 ? wert * negativFaktor(k) : wert;
        }
        break;
      case 'motivation':
        for (const k of kinderZiel(state, e.ziel ?? 'kind', b, e.rolle, e.team)) {
          k.werte.motivation = clamp(k.werte.motivation + wert, 1, 20);
        }
        break;
      case 'austrittsRisiko':
        for (const k of kinderZiel(state, e.ziel ?? 'kind', b, e.rolle, e.team)) k.austrittsRisikoZusatz += wert;
        break;
      case 'elternStimmung':
        for (const p of elternZiel(state, e.ziel ?? 'elternteil', b)) p.stimmung = clamp(p.stimmung + wert, 0, 100);
        break;
      case 'trainerBelastung':
        for (const t of trainerZiel(state, e.ziel ?? 'trainer', b)) t.belastung = clamp(t.belastung + wert, 0, 100);
        break;
      case 'trainerMotivation':
        for (const t of trainerZiel(state, e.ziel ?? 'trainer', b)) t.motivation = clamp(t.motivation + wert, 1, 20);
        break;
      case 'kasse':
        buchen(state, { kategorie: 'ereignis', text: e.text ?? 'Ereignis', betrag: wert }, ctx.buchungen);
        break;
      case 'ruf':
        state.verein.ruf = clamp(state.verein.ruf + wert, 0, 100);
        break;
      case 'teamFlag': {
        const team = state.teams[b[e.ziel ?? 'team'] ?? ''];
        if (team && e.flag) team.flags[e.flag] = e.wert !== false;
        break;
      }
      case 'kindFlag': {
        const k = state.kinder[b[e.ziel ?? 'kind'] ?? ''];
        if (k && e.flag) k.flags[e.flag] = e.wert !== false;
        break;
      }
      case 'training': {
        const team = state.teams[b[e.ziel ?? 'team'] ?? ''];
        if (team && e.aktion) {
          state.trainingsAnpassungen[team.id] = e.aktion as TrainingsAnpassung;
          if (e.aktion === 'zusammenlegen') {
            const anderes = b['anderesTeam'];
            if (anderes) state.zusammenlegungen[team.id] = anderes;
          }
        }
        break;
      }
      case 'schnupperKinder': {
        const [min, max] = (e.anzahl ?? [1, 3]) as [number, number];
        const [amin, amax] = (e.alter ?? [6, 17]) as [number, number];
        const anzahl = rng.int(min, max);
        for (let i = 0; i < anzahl; i++) {
          const k = neuesSchnupperkind(state, rng, rng.int(amin, amax));
          if (k) ctx.schnupper.push(k);
        }
        break;
      }
      case 'neuesKind': {
        const [amin, amax] = (e.alter ?? [8, 16]) as [number, number];
        const talent = (e.talent ?? [10, 16]) as [number, number];
        const k = neuesSchnupperkind(state, rng, rng.int(amin, amax), talent);
        if (k) ctx.schnupper.push(k);
        break;
      }
      case 'elternZuTrainer': {
        const el = state.eltern[b[e.ziel ?? 'elternteil'] ?? ''];
        const team = state.teams[b[e.team ?? 'team'] ?? ''];
        if (el && team && team.trainer.length < B.trainer.maxTeamgroesse) {
          const t = trainerAusElternteil(state, rng, el);
          team.trainer.push({ trainerId: t.id, rolle: 'betreuer' });
          ctx.meldungen.push(`${name(t)} ist neu als Betreuer:in bei ${team.name} dabei.`);
        }
        break;
      }
      case 'beziehung': {
        const von = state.trainer[b[e.von ?? ''] ?? ''];
        const zu = state.trainer[b[e.zu ?? ''] ?? ''];
        if (von && zu) {
          for (const [x, y] of [
            [von, zu],
            [zu, von]
          ] as const) {
            let bz = x.beziehungen.find((r) => r.zielId === y.id);
            if (!bz) {
              bz = { zielId: y.id, art: 'kollegial', staerke: 0 };
              x.beziehungen.push(bz);
            }
            bz.staerke = clamp(bz.staerke + wert, -100, 100);
            bz.art = bz.staerke < -20 ? 'konflikt' : 'kollegial';
          }
        }
        break;
      }
      case 'familieHaertefall': {
        const k = state.kinder[b[e.ziel ?? 'kind'] ?? ''];
        const f = k ? state.familien[k.familieId] : undefined;
        if (f) f.haertefall = true;
        break;
      }
      case 'zufall': {
        if (rng.chance(e.wahrscheinlichkeit ?? 0.5)) {
          if (e.text) ctx.meldungen.push(e.text);
          wendeEffekteAn(state, rng, e.dann ?? [], b, ctx);
        } else {
          wendeEffekteAn(state, rng, e.sonst ?? [], b, ctx);
        }
        break;
      }
    }
  }
}

/** Erzeugt ein Schnupperkind und teilt es dem passenden Team zu. */
export function neuesSchnupperkind(state: GameState, rng: Rng, alterJahre: number, talent?: [number, number]): Kind | null {
  const stufe = stufeFuerAlter(alterJahre);
  if (!stufe) return null;
  const team = passendesTeam(state, stufe);
  if (!team) return null;
  const k = erzeugeKindMitFamilie(state, rng, { alter: alterJahre, status: 'schnupper', zufriedenheit: 60, talentBereich: talent });
  k.teamId = team.id;
  return k;
}

/** Wendet die gewählte Option eines Ereignisses an. */
export function loeseEreignis(state: GameState, rng: Rng, inst: EreignisInstanz, optionId: string, ctx: EffektKontext): void {
  const vorlage = ereignisVorlage(inst.vorlageId);
  const option = vorlage.optionen.find((o) => o.id === optionId);
  if (!option) throw new Error(`Option ${optionId} gibt es bei ${inst.vorlageId} nicht`);
  if (!inst.verfuegbareOptionen.includes(optionId)) throw new Error(`Option ${optionId} ist nicht verfügbar`);
  wendeEffekteAn(state, rng, option.effekte, inst.beteiligte, ctx);
  inst.erledigt = { optionId, text: ersetzePlatzhalter(state, option.folge, inst.beteiligte, inst.variablen) };
  const nachricht = state.posteingang.find((n) => n.ereignisId === inst.id);
  if (nachricht) nachricht.gelesen = true;
}

export function offeneEreignisse(state: GameState): EreignisInstanz[] {
  return state.ereignisse.filter((e) => !e.erledigt);
}

export function offenePflichtEreignisse(state: GameState): EreignisInstanz[] {
  return offeneEreignisse(state).filter((e) => e.pflicht);
}

export function optionText(state: GameState, inst: EreignisInstanz, optionId: string): string {
  const o = ereignisVorlage(inst.vorlageId).optionen.find((x) => x.id === optionId);
  return o ? ersetzePlatzhalter(state, o.text, inst.beteiligte, inst.variablen) : optionId;
}

/** Kontext für die Ereigniserzeugung der aktuellen Woche (state.woche). */
export function ereignisKontext(state: GameState): EreignisKontext {
  const info = aktuelleWoche(state);
  const abw = info.ferien ? info.ferien.abwesenheitKinder : B.abwesenheit.normal;
  const erwarteteAnwesende: Record<Id, number> = {};
  for (const t of Object.values(state.teams)) {
    erwarteteAnwesende[t.id] = teamKinder(state, t.id).length * (1 - abw);
  }
  return { info, erwarteteAnwesende };
}

