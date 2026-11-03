# Juniorenmanager – Projektkontext für Claude

Rundenbasiertes Managerspiel im Browser: Die spielende Person führt die Juniorenabteilung eines
Streethockey-Vereins nach den Grundsätzen von Jugend+Sport. Ziel: möglichst viele und möglichst
glückliche Junior:innen. Vollständiges Konzept: `docs/spielkonzept.md`. Entscheide aus der
Umsetzung: `docs/entscheide.md`. Etappen-Prompts: `docs/prompts/`.

Stand: **Etappe 1 von 6** umgesetzt (Kern-Simulation, Teams, Wirtschaft, Wettkampf, Ereignisse).

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm test` – Vitest (Spielkern und Speicherung)
- `npm run build` – Typprüfung (`tsc -b`) und Produktions-Build
- `npm run typecheck` – nur Typprüfung

Nach jeder grösseren Änderung: `npm test` und `npm run build`.

## Architektur (verbindlich)

```
src/
  engine/     reiner TypeScript-Spielkern – KEIN React, KEINE Browser-APIs (kein window, fetch, IndexedDB)
  content/    JSON-Inhalte: balancing.json, ereignisse.json, namen.json, charakterzuege.json, ferien.json, anwerbung.json, gegner.json
  ui/         React-Oberfläche (liest den Spielkern nur über src/engine/index.ts)
  storage/    SaveRepository-Interface, IndexedDB- und Memory-Umsetzung, JSON-Export/-Import
public/portraits/   Bildpool (portraits.json + {gruppe}_{nummer}_{stimmung}.webp)
```

### Regeln für den Spielkern

- Einstieg: `simulateWeek(state, decisions) → { state, events, report }` in `engine/simulation.ts`.
  Reine Funktion: Eingabe-State wird nie verändert (intern `klonen()`), Ergebnis hängt nur von State + Entscheiden ab.
- Zufall **nur** über `Rng` (mulberry32) mit `state.rngState`. Nie `Math.random()` oder `Date.now()` im Kern.
  Neues Spiel: Seed kommt von aussen (`neuesSpiel({ seed })`).
- Iterationsreihenfolge muss deterministisch sein (Objekt-Schlüssel in Einfügereihenfolge; IDs über `neueId()`).
- Spielstand ist vollständig JSON-serialisierbar (keine Klassen, Dates, Maps, Sets).
- Schema-Änderungen am `GameState`: `SCHEMA_VERSION` in `engine/migrations.ts` erhöhen und Migration ergänzen.
- Alle Zahlen fürs Balancing gehören in `src/content/balancing.json`, nicht in den Code.
- Ereignisse sind datengetrieben (`src/content/ereignisse.json`). Neue Auswahl-, Bedingungs- oder
  Effekttypen in `engine/ereignisse.ts` ergänzen und im Kopfkommentar dokumentieren.
- Entscheide sind ein diskriminierter Union-Typ `Entscheid` (`engine/types.ts`), angewendet in `engine/entscheide.ts`.
  Die UI sammelt sie als Wochen-Entwurf und zeigt eine Vorschau über `vorschau()`.
- Pflicht-Ereignisse blockieren `simulateWeek` (`PflichtEreignisOffenError`).

### Vorbereitet für spätere Etappen

Datenmodell enthält bereits: `Beziehung` zwischen Personen, `fairplay` bei Kindern, `einfluss`/`stimmung` bei
Eltern, `verein.ruf` und `verein.vorstandEinfluss`, `qualifikation` (J+S) bei Trainer:innen,
`state.erweiterungen` als Platz für neue Systeme. Supabase (Etappe 5) = neue Klasse, die `SaveRepository` erfüllt.

## Konventionen

- Sprache in Code-Bezeichnern, Kommentaren und UI: Deutsch. UI-Texte Hochdeutsch in Schweizer Schreibweise:
  **kein ß** (immer «ss»), Anführungszeichen «…», Beträge «CHF 1’234» (Hilfsfunktion `chf()`).
- Geschlechtergerechte Sprache mit Doppelpunkt: Trainer:innen, Junior:innen.
- Umlaute in Code-Bezeichnern umschreiben (`zufriedenheit`, `aenderbar`, `bedrueckt`).
- TypeScript strict inkl. `noUncheckedIndexedAccess`.
- Tests für den Spielkern liegen in `src/engine/tests/`, Hilfen in `tests/hilfen.ts`.
- UI: mobile first, Tastaturbedienung, sichtbarer Fokus, genügend Kontrast (Farb-Tokens in `ui/styles.css`, hell/dunkel).
- Portraits: Komponente `ui/components/Portrait.tsx`; Stimmung > 66 froh, 34–66 neutral, < 34 bedrückt.
