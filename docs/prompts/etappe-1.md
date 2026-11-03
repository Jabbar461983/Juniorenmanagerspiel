# Prompt für Claude Code – Juniorenmanager, Etappe 1

Wir bauen «Juniorenmanager» (Arbeitstitel), ein rundenbasiertes Managerspiel im Browser. Du bist Juniorenverantwortliche:r eines Streethockey-Vereins und baust über mehrere Saisons eine Juniorenabteilung nach den Grundsätzen von Jugend+Sport auf. Ziel: möglichst viele und möglichst glückliche Junioren.

Das vollständige Spielkonzept liegt in `docs/spielkonzept.md`. Lies es zuerst ganz. Dieser Prompt beschreibt nur **Etappe 1 von 6**. Baue so, dass die späteren Etappen (Eltern-Einfluss, Dialoge, Vorstand, Social Media, J+S, heikle Fälle, Cloud, Liga) ohne Umbau dazukommen.

## Vorgehen

1. Lies `docs/spielkonzept.md` und diesen Prompt.
2. Lege einen Umsetzungsplan vor und stelle mir offene Fragen, bevor du Code schreibst.
3. Baue in kleinen, sinnvollen Commits. Nach jedem grösseren Schritt: Tests und Build laufen lassen.
4. Am Schluss: Deployment auf GitHub Pages über GitHub Actions einrichten und mir erklären, was ich im Repo einstellen muss.

## Technik

- Vite + React + TypeScript (strict), PWA mit `vite-plugin-pwa`
- Tests mit Vitest
- Hosting: GitHub Pages, Deployment über GitHub Actions (Base-Pfad korrekt setzen)
- Noch kein Backend. Speicherung über ein Interface `SaveRepository` mit lokaler Umsetzung (IndexedDB oder localStorage) plus JSON-Export/-Import. Eine Supabase-Umsetzung kommt in Etappe 5 und muss sich ohne Änderungen am Spielkern einfügen lassen.

## Architektur (verbindlich)

```
src/
  engine/     reiner TypeScript-Spielkern, KEIN React, KEIN Browser-API
  content/    JSON-Inhalte: Namen, Charakterzüge, Ereignisse, Ferien, Konstanten
  ui/         React-Oberfläche
  storage/    SaveRepository und Umsetzungen
docs/         Spielkonzept, Entscheide
```

- Der Spielkern ist eine reine Funktion: `simulateWeek(state, decisions) → { state, events, report }`.
- Zufall nur über einen seed-basierten Zufallsgenerator (z.B. mulberry32), der Seed liegt im Spielstand. Gleicher Spielstand + gleiche Entscheide = gleiches Ergebnis. Grund: Fehlersuche und später serverseitige Simulation für die Liga.
- Spielstand ist vollständig als JSON serialisierbar und hat eine Schema-Version mit Migrationen.
- Alle Balancing-Werte (Gewichte, Kosten, Wahrscheinlichkeiten) in einer zentralen Konfigurationsdatei, nicht im Code verstreut.
- Ereignisse sind datengetrieben (JSON): Auslöser-Bedingungen, Beteiligte, Optionen, Effekte. So können später Dialoge und heikle Fälle als Inhalte ergänzt werden.

## Umfang Etappe 1

### Neues Spiel
- Vereinsname, Laufzeit in Saisons (frei wählbar, Standard 5), Startbudget, Seed (automatisch)
- Startsituation: kleine bestehende Abteilung mit einigen Kindern und Trainer:innen pro Stufe

### Kalender
- Saison Juni bis Mai, 52 Wochenrunden, keine Winterpause
- Phasen: Vorbereitung (Juni–Juli), Trainingsstart (August–Mitte September), Meisterschaft (Ende September–Februar), Playoffs U18 (März–April), Finalturniere und Abschluss (Mai)
- Schulferien als konfigurierbare Daten (Standard: Kanton Bern), mit erhöhten Abwesenheiten

### Personen-Generator
- Kinder 6–17 Jahre, Mädchen und Knaben; 1–2 Elternteile pro Kind, Geschwister möglich; Trainer:innen 16–75 Jahre
- Werte 1–20 und 1–2 Charakterzüge gemäss Spielkonzept; Talent ist verborgen
- Trainer-Startwerte nach Altersprofil: Ältere stark bei Organisation und Erfahrung, Jüngere bei Kinderverständnis und aktuellem Fachwissen, mit Streuung
- Namen vielfältig, wie in einem Schweizer Verein üblich (verschiedene Herkünfte)
- Jede Person hat Portrait-Metadaten: Altersgruppe (kind, jugend, jung, erwachsen, aelter), Geschlecht, Hautton

### Portraits (Platzhalter mit späterem Austausch)
- Komponente `Portrait` zeigt vorerst einen schlichten, neutralen Platzhalter (Silhouette mit Hautton und Initialen), Stimmung über Rahmenfarbe oder Symbol
- Vorbereiten für den Bildpool: Dateien `public/portraits/{gruppe}_{nummer}_{stimmung}.webp` (stimmung: froh, neutral, bedrueckt) plus `public/portraits/portraits.json` mit Metadaten. Liegt die Datei vor, zeigt die Komponente das Foto, sonst den Platzhalter
- Stimmung folgt der Zufriedenheit: über 66 froh, 34–66 neutral, unter 34 bedrückt

### Teams
- Stufen U9 (6–8), U12 (9–11), U15 (12–14), U18 (15–17), Mädchen und Knaben gemischt
- Pro Team mindestens 1, maximal 4 Trainer:innen; Rollen: Haupttrainer:in, Co-Trainer:in, Torhütertrainer:in, Betreuer:in/Hilfsleiter:in
- Team-Wert pro Skill = bester Wert + Anteil der übrigen; Bonus für Generationen-Mix (eine Person über 40 und eine unter 26) und gemischtes Trainerteam; kaum Zusatznutzen bei mehr als 2 Personen mit gleichem Schwerpunkt
- Zu grosse Teams senken Einsatzzeit und Zufriedenheit; zweites Team pro Stufe möglich

### Wochenrunde
1. Lagebericht und Posteingang
2. Entscheide: Trainer zuteilen, Trainingsplan pro Team (Anzahl Trainings, Schwerpunkt), Anwerbungsmassnahmen, Mitgliederbeiträge (nur in der Vorbereitung änderbar)
3. Offene Ereignisse bearbeiten (Pflicht-Ereignisse blockieren das Weiterspielen)
4. Woche simulieren
5. Wochenbericht mit Veränderungen

### Zufriedenheit
- Pro Kind 0–100, Zielwert aus: Trainerbeziehung 25 %, Teamklima 20 %, Spass und Einsatzzeit 20 %, Entwicklung 15 %, Elterneinfluss 10 %, Rahmen 10 %
- Annäherung: `Z_neu = Z_alt + 0.2 × (Z_ziel − Z_alt) + E` (E = einmalige Effekte aus Ereignissen)
- Austrittswahrscheinlichkeit steigt stark unter 40 und bei tiefer Motivation, Hauptaustrittsfenster am Saisonende; zufriedene Kinder bringen Freunde mit

### Wirtschaft
- Wöchentliche Buchungen: Beiträge, Hallenmiete, Material, Trainerentschädigung, Anwerbung, Verbandsgebühren
- Beiträge pro Stufe, Geschwisterrabatt, Härtefallfonds; höhere Beiträge senken Eintritte und erhöhen Austritte
- Anwerbungsmassnahmen mit Kosten, Reichweite und Zielalter (Schnuppertag, Schulbesuch, Flyer, Online-Werbung); Schnupperkinder bleiben je nach erstem Eindruck
- Kasse zwei Wochen in Folge unter null → Warnung (Vorstand folgt in Etappe 3)

### Wettkampf (simuliert)
- U9: Turniere ohne Rangliste
- U12 und U15: je 8 Turniere in einer Liga mit 8 Teams, die ersten 6 ans Finalturnier im Mai
- U18: Meisterschaft mit 10 Teams (Hin- und Rückrunde), die ersten 8 in die Playoffs ab Anfang März: Viertel-, Halbfinal, Final, jeweils best of 3
- Gegnerteams als computergesteuerte Vereine mit Stärkewert
- Spielergebnis aus Teamstärke, Trainer-Fachwissen, Tagesform; Einsatzzeit wirkt auf die Zufriedenheit

### Ereignisse Etappe 1 (datengetrieben)
- Kurzfristige Trainerabsage: Ersatz aus anderem Team, Hilfsleiter:in aus der U18, Teams zusammenlegen oder absagen
- Halle doppelt belegt
- Ferienabwesenheiten: normal durchführen, Teams zusammenlegen, Kleingruppen-Event oder absagen. Absagen senken die Motivation von Kindern und Eltern, mehrere in Folge verstärkt
- Eltern beschweren sich über Spielzeiten: nachgeben, Regeln erklären, abblocken; mit Folgen für andere Familien
- Mindestens 10 Ereignisse insgesamt, ausbalanciert

### Saisonende
- Saisonbilanz, Übertritte nach Jahrgang in die nächste Stufe, U18-Abgänger verlassen die Abteilung
- In Etappe 1 endet das Spiel nach einer Saison mit einer vorläufigen Bewertung (Anzahl × Zufriedenheit), die Laufzeit-Logik ist aber schon vorhanden

## Oberfläche

- Mobile first, funktioniert auch auf dem Desktop; ruhiger, übersichtlicher Manager-Stil
- Sprache Hochdeutsch in Schweizer Schreibweise (kein ß), Beträge in CHF
- Bildschirme: Start/Neues Spiel, Übersicht (Kennzahlen), Posteingang, Teams, Personen (Portrait-Karten mit Detailansicht), Finanzen, Kalender und Wettkampf (Tabellen, Turniere, Playoffs), Wochenbericht, Speichern/Laden
- Zugänglich: Tastaturbedienung, genügend Kontrast

## Nicht in Etappe 1

Vorstand, Social Media, Sponsoren, J+S-Mechaniken, Dialogsystem, heikle Fälle, Sanitätsmaterial, Fairplay, Budgetkürzungen, Login, Supabase, Liga. Das Datenmodell soll diese Themen aber schon vorsehen (z.B. Beziehungen zwischen Personen, Fairplay-Wert, Einfluss-Werte).

## Qualität

- Vitest-Tests für den Spielkern: Determinismus mit Seed, Zufriedenheitsformel, Wettkampfmodus (Qualifikation, best of 3), Übertritte, Buchungen
- `CLAUDE.md` mit Projektkontext, Architekturregeln und Konventionen für künftige Sessions
- `README.md` mit Start, Tests, Build und Deployment
- `docs/entscheide.md` für Entscheide, die du während der Umsetzung triffst
