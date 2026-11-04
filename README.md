# Juniorenmanager

Rundenbasiertes Managerspiel im Browser: Du bist Juniorenverantwortliche:r eines Streethockey-Vereins
und baust über mehrere Saisons eine Juniorenabteilung nach den Grundsätzen von Jugend+Sport auf.
Ziel: möglichst viele und möglichst glückliche Junior:innen.

Aktueller Stand: **Etappe 3** – mehrere Saisons bis zur gewählten Laufzeit mit Teams, Trainer:innen,
Wochenplanung, Zufriedenheit, Wirtschaft, simuliertem Wettkampf, Eltern-Einfluss und Gesprächen,
dazu Vorstand mit Sitzungen und GV, Social Media, Sponsoren, Aktionen zur Geldbeschaffung,
Endbewertung und Saisonchronik. Ein Lernmodus verhindert das vorzeitige Spielende.

- Spielkonzept: [docs/spielkonzept.md](docs/spielkonzept.md)
- Entscheide während der Umsetzung: [docs/entscheide.md](docs/entscheide.md)

## Voraussetzungen

Node.js 22 (oder neuer) und npm.

## Starten

```bash
npm install
```

```bash
npm run dev
```

Danach die angezeigte Adresse (meist http://localhost:5173) im Browser öffnen.

## Tests

```bash
npm test
```

Getestet werden u.a. Determinismus mit Seed, Zufriedenheitsformel, Wettkampfmodus (Qualifikation,
best of 3), Übertritte, Buchungen und die Speicherung.

## Build

```bash
npm run build
```

Ergebnis in `dist/`. Lokal ansehen:

```bash
npm run preview
```

Für einen Build mit Unterpfad (wie auf GitHub Pages):

```bash
BASE_PATH=/Juniorenmanagerspiel/ npm run build
```

## Deployment (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` führt bei jedem Push auf `main` Tests und Build aus und
veröffentlicht `dist/` auf GitHub Pages. Bei Pull Requests laufen nur Tests und Build.

Einmalig im Repository einstellen:

1. **Settings → Pages → Build and deployment → Source: «GitHub Actions»** wählen.
2. Falls unter **Settings → Actions → General** Workflows eingeschränkt sind: «Allow all actions» bzw.
   die Actions von GitHub (`actions/*`) erlauben.
3. Änderungen auf `main` mergen (oder den Workflow unter **Actions → Run workflow** manuell starten).

Die Seite ist danach unter `https://<benutzername>.github.io/Juniorenmanagerspiel/` erreichbar. Der
Base-Pfad wird im Workflow automatisch aus dem Repository-Namen gesetzt.

## Spielstände

Spielstände werden lokal im Browser (IndexedDB) gespeichert – automatisch nach jeder Woche. Unter
«Speichern/Laden» lassen sie sich als JSON exportieren und wieder importieren (z.B. für einen
Gerätewechsel). Eine Cloud-Speicherung folgt in Etappe 5.

## Portraits

Bis der Bildpool steht, zeigt das Spiel Platzhalter. Bilder kommen nach `public/portraits/` als
`{gruppe}_{nummer}_{stimmung}.webp` (z.B. `kind_017_froh.webp`; Gruppen: kind, jugend, jung,
erwachsen, aelter; Stimmungen: froh, neutral, bedrueckt) und werden in `public/portraits/portraits.json`
eingetragen:

```json
{ "version": 1, "bilder": [ { "gruppe": "kind", "nummer": 17, "geschlecht": "w", "hautton": "mittel" } ] }
```

Hauttöne: `hell`, `hell-mittel`, `mittel`, `mittel-dunkel`, `dunkel`. Fehlt eine Datei, erscheint der Platzhalter.

## Projektstruktur

```
src/engine/    Spielkern (reines TypeScript, deterministisch)
src/content/   Inhalte und Balancing als JSON
src/ui/        React-Oberfläche
src/storage/   Speicherung (SaveRepository, IndexedDB, JSON)
```
