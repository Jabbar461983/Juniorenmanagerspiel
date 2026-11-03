// Zentraler Spielzustand der Oberfläche.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  neuesSpiel,
  offenePflichtEreignisse,
  simulateWeek,
  vorschau,
  type Entscheid,
  type GameState,
  type NeuesSpielOptionen,
  type WochenBericht
} from '../engine';
import { erstelleRepository, metaFuer, type SaveRepository, type Spielstand } from '../storage';
import { entscheidHinzufuegen } from './entwurf';

export interface SpielApi {
  repo: SaveRepository;
  stand: Spielstand | null;
  /** Spielstand inkl. Entwurf (ohne Ereignisse) */
  ansicht: GameState | null;
  vorschauFehler: string[];
  bericht: WochenBericht | null;
  meldung: string | null;
  setMeldung: (m: string | null) => void;
  neues: (opt: NeuesSpielOptionen) => Promise<void>;
  laden: (id: string) => Promise<void>;
  uebernehmen: (stand: Spielstand) => Promise<void>;
  schliessen: () => void;
  entscheiden: (e: Entscheid) => void;
  entfernen: (index: number) => void;
  simulieren: () => Promise<boolean>;
  speichernUnter: (name: string) => Promise<void>;
  offenePflicht: number;
  gelesen: (nachrichtId: string) => void;
}

function neueSpeicherId(): string {
  return `spiel-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function useSpiel(): SpielApi {
  const repo = useMemo(() => erstelleRepository(), []);
  const [stand, setStand] = useState<Spielstand | null>(null);
  const [bericht, setBericht] = useState<WochenBericht | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const speicherTimer = useRef<number | null>(null);

  const { ansicht, vorschauFehler } = useMemo(() => {
    if (!stand) return { ansicht: null, vorschauFehler: [] as string[] };
    if (stand.entwurf.length === 0) return { ansicht: stand.state, vorschauFehler: [] as string[] };
    const v = vorschau(stand.state, stand.entwurf);
    return { ansicht: v.state, vorschauFehler: v.fehler };
  }, [stand]);

  // Entwurf verzögert sichern
  useEffect(() => {
    if (!stand) return;
    if (speicherTimer.current) window.clearTimeout(speicherTimer.current);
    speicherTimer.current = window.setTimeout(() => {
      repo.speichern(stand).catch(() => setMeldung('Speichern fehlgeschlagen.'));
    }, 600);
    return () => {
      if (speicherTimer.current) window.clearTimeout(speicherTimer.current);
    };
  }, [stand, repo]);

  const neues = useCallback(
    async (opt: NeuesSpielOptionen) => {
      const state = neuesSpiel(opt);
      const s: Spielstand = { meta: metaFuer(state, neueSpeicherId(), state.verein.name, true), state, entwurf: [] };
      await repo.speichern(s);
      setBericht(null);
      setStand(s);
    },
    [repo]
  );

  const laden = useCallback(
    async (id: string) => {
      const s = await repo.laden(id);
      if (!s) {
        setMeldung('Spielstand nicht gefunden.');
        return;
      }
      setBericht(null);
      setStand(s);
    },
    [repo]
  );

  const uebernehmen = useCallback(
    async (s: Spielstand) => {
      const neu: Spielstand = { ...s, meta: { ...s.meta, id: neueSpeicherId() } };
      await repo.speichern(neu);
      setBericht(null);
      setStand(neu);
    },
    [repo]
  );

  const entscheiden = useCallback((e: Entscheid) => {
    setStand((s) => (s ? { ...s, entwurf: entscheidHinzufuegen(s.entwurf, e) } : s));
  }, []);

  const entfernen = useCallback((index: number) => {
    setStand((s) => (s ? { ...s, entwurf: s.entwurf.filter((_, i) => i !== index) } : s));
  }, []);

  const simulieren = useCallback(async () => {
    if (!stand) return false;
    try {
      const r = simulateWeek(stand.state, stand.entwurf);
      const neu: Spielstand = {
        meta: metaFuer(r.state, stand.meta.id, stand.meta.name, stand.meta.autosave),
        state: r.state,
        entwurf: []
      };
      setStand(neu);
      setBericht(r.report);
      await repo.speichern(neu);
      return true;
    } catch (err) {
      setMeldung((err as Error).message);
      return false;
    }
  }, [stand, repo]);

  const speichernUnter = useCallback(
    async (name: string) => {
      if (!stand) return;
      const neu: Spielstand = { ...stand, meta: metaFuer(stand.state, neueSpeicherId(), name, false) };
      await repo.speichern(neu);
      setStand(neu);
      setMeldung(`Gespeichert als «${name}».`);
    },
    [stand, repo]
  );

  const offenePflicht = useMemo(() => {
    if (!stand) return 0;
    const gewaehlt = new Set(stand.entwurf.filter((e) => e.typ === 'ereignis').map((e) => (e as { ereignisId: string }).ereignisId));
    return offenePflichtEreignisse(stand.state).filter((e) => !gewaehlt.has(e.id)).length;
  }, [stand]);

  const gelesen = useCallback((id: string) => {
    setStand((s) =>
      s
        ? { ...s, state: { ...s.state, posteingang: s.state.posteingang.map((n) => (n.id === id ? { ...n, gelesen: true } : n)) } }
        : s
    );
  }, []);

  return {
    gelesen,
    repo,
    stand,
    ansicht,
    vorschauFehler,
    bericht,
    meldung,
    setMeldung,
    neues,
    laden,
    uebernehmen,
    schliessen: () => {
      setStand(null);
      setBericht(null);
    },
    entscheiden,
    entfernen,
    simulieren,
    speichernUnter,
    offenePflicht
  };
}
