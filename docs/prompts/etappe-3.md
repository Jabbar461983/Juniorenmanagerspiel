# Prompt für Claude Code – Juniorenmanager, Etappe 3

Etappen 1 und 2 sind umgesetzt. Lies zuerst `CLAUDE.md`, `docs/spielkonzept.md`, `docs/entscheide.md` und diesen Prompt.

Diese Etappe: **Vorstand, Einfluss, Social Media, Sponsoren und Geldbeschaffung.** Die Juniorenabteilung wird Teil der Vereinspolitik. Ab dieser Etappe ist das Spiel über mehrere Saisons spielbar (`etappeMaxSaisons` aufheben, Laufzeit gilt).

## Vorgehen

1. Dokumente und Code lesen, Umsetzungsplan vorlegen, offene Fragen stellen.
2. Kleine Commits, Tests und Build nach jedem Schritt.
3. Schema-Version erhöhen, Migration Etappe 2 → 3 mit Test.
4. `docs/entscheide.md` und `CLAUDE.md` nachführen.

## Umfang Etappe 3

### Vorstand und Einfluss
- Vorstandsmitglieder als Personen: Präsident:in, Kassier:in, Sportchef:in, Kommunikation, weitere Mitglieder. Jede Person hat eine Haltung zu den Junioren (Unterstützer, neutral, skeptisch) und eigene Prioritäten (Aktivmannschaft, Finanzen, Vereinsimage …).
- **Einfluss** der Spieler:in (0–100) wirkt auf Budget, Trainingszeiten (Hallen) und Sichtbarkeit. Er steigt mit Erfolgen, guter Vorbereitung und Verbündeten und sinkt mit Budgetüberschreitungen, Konflikten und Skandalen.
- **Vorstandssitzung monatlich:** Anträge stellen (Budget, neues Team, Trainerentschädigung, Material, Hallenzeiten). Vorbereitung (Bericht, Einzelgespräche) erhöht die Chance. Abstimmung nach Haltungen und Einfluss.
- **Einzelgespräche** über das Dialogsystem aus Etappe 2 (Vorstandsgespräche als Inhalte).
- **GV einmal pro Saison:** Jahresbudget der Juniorenabteilung (ersetzt den pauschalen Vereinsbeitrag aus Etappe 1), Wahl in den Vorstand, Mitgliederstimmung.
- **Budget-Konkurs:** Die Warnung aus Etappe 1 wird zur Kette: Massnahmen verlangen, dann Kürzungen, dann Absetzung.
- **Vorzeitiges Spielende** gemäss Konzept: Absetzung (Einfluss unter 10), Konkurs ohne Rettungsplan, Abteilung aufgelöst (kein spielfähiges Team).

### Budgetkürzungen und Geldbeschaffung
- Ereignis «Budgetkürzung» des Gesamtvereins; Spieler:in entscheidet, wo gespart wird.
- Aktivitäten aus dem Konzept: Kuchenverkauf, Sponsorenlauf, Grümpelturnier, Lotto-Abend, Altpapier-/Weihnachtsbaumaktion, Stiftungs- oder Gemeindegesuch, Crowdfunding. Je Aufwand, Helferbedarf (Elternhilfe aus Etappe 2), Ertrag, Risiko; parallele Aktivitäten überlasten dieselben Helfer.

### Sponsoren
- Sponsoren melden sich abhängig von Ruf und Reichweite oder werden akquiriert; Vertrag mit Betrag, Laufzeit und Gegenleistung (Logo, Social Media).
- Sponsor-Typ-Eltern (Etappe 2) mit Risiko Bevorzugung des eigenen Kindes.

### Social Media
- Kommunikationsverantwortliche:r im Vorstand entscheidet die Grundfrequenz; Spieler:in liefert Inhalte (Matchbericht, Lager, Trainerportrait, Anlass) oder investiert selbst.
- Wirkung auf Reichweite (Schnupperanfragen, Sponsoreninteresse) und Ruf (Vorstandseinfluss, Gemeinde, Trainerrekrutierung).
- **Einwilligung der Eltern** für Bilder von Kindern als Datenfeld pro Kind; Posts ohne Einwilligung lösen Ereignisse aus.
- Krisen: negative Posts von Eltern (Kritiker:innen aus Etappe 2) verlangen schnelle, korrekte Kommunikation (Dialog/Ereignis).

### Endbewertung
- Volle Endbewertung nach Konzept: aktive Junioren 35 %, Zufriedenheit 35 %, Ruf und Vorstandseinfluss 10 %, Trainerstruktur 10 %, Umgang mit heiklen Fällen 5 % (bis Etappe 4 neutral), Finanzen 5 %. Titel und Saisonchronik.

### Inhalte
- Mindestens 10 neue Ereignisse (Vorstand, Sponsoren, Social Media, Anlässe) und 5 Vorstands-Dialoge.

## Oberfläche
- Bildschirm Vorstand: Mitglieder mit Portrait und Haltung, Einfluss-Verlauf, Sitzungskalender, Anträge vorbereiten.
- Bildschirm Social Media: geplante und veröffentlichte Posts, Reichweite, Ruf, Einwilligungen.
- Finanzen erweitert: Jahresbudget, Sponsoren, Aktivitäten zur Geldbeschaffung.
- Saisonchronik und Endbewertung am Spielende.

## Nicht in Etappe 3

J+S-Mechaniken, heikle Fälle, Sanitätsmaterial, Fairplay-System, Cloud, Liga.

## Qualität

- Vitest: Abstimmungslogik, Einfluss-Grenzen, GV-Budget, Konkurs-Kette und vorzeitiges Spielende, Sponsorenverträge, Social-Media-Wirkung, Endbewertung, Migration 2 → 3, Determinismus über 3 Saisons.
- Probeläufe über die Standardlaufzeit (5 Saisons) mit unterschiedlichen Strategien; Ergebnisse in `docs/entscheide.md`.
