# Prompt für Claude Code – Juniorenmanager, Etappe 4

Etappen 1–3 sind umgesetzt. Lies zuerst `CLAUDE.md`, `docs/spielkonzept.md`, `docs/entscheide.md` und diesen Prompt.

Diese Etappe: **Jugend+Sport, Prävention, heikle Fälle, Fairplay und Sanitätsmaterial.** J+S wird zur Spielregel; heikle Themen werden mit Präventionsfokus spielbar.

## Vor dem Start (Aufgabe der Projektleitung)

- J+S-Kursnamen, Altersgrenzen, Anerkennungsdauer und Beitragsregeln an den offiziellen Unterlagen prüfen und hier oder in `docs/entscheide.md` festhalten. Ohne diese Angaben verwendet Claude klar markierte Platzhalterwerte in `balancing.json`.
- Texte zu heiklen Fällen vor der Veröffentlichung durch eine Fachperson (z.B. Präventionsstelle) gegenlesen lassen.

## Vorgehen

1. Dokumente und Code lesen, Umsetzungsplan vorlegen, offene Fragen stellen.
2. Kleine Commits, Tests und Build nach jedem Schritt.
3. Schema-Version erhöhen, Migration 3 → 4 mit Test.
4. `docs/entscheide.md` und `CLAUDE.md` nachführen.

## Umfang Etappe 4

### Jugend+Sport
- **J+S-Kurse melden:** Jedes Team läuft als J+S-Angebot. Korrekt gemeldete Trainings und Anwesenheiten lösen Beiträge aus; vergessene oder fehlerhafte Meldungen kosten Geld. Meldequalität hängt von der Organisation (J+S-Coach, Trainer-Skill Organisation) ab.
- **Leiteranerkennung:** Trainer:innen brauchen eine Anerkennung (Feld `qualifikation` aus Etappe 1). Kurse kosten Zeit und Geld, steigern Skills; die Anerkennung verfällt ohne Weiterbildung. Ausbildung als planbare Entscheide.
- **J+S-Coach:** Pflichtrolle im Verein (Person ernennen); verbindet mit J+S, plant Ausbildung, erledigt Meldungen.
- **Kindgerechtes Training:** Falsche Belastung (zu leistungsorientiert bei U9, zu viel Kondition) senkt Zufriedenheit und erhöht Verletzungen; Bewegungsvielfalt und Spielformen werden belohnt.

### Prävention als Vereinsstruktur
- Vertrauensperson ernennen und bekannt machen; Verhaltenskodex mit Unterschrift; Vier-Augen-Prinzip (Garderobe, Transport, Lager); Strafregister- bzw. Sonderprivatauszug bei neuen Trainer:innen; Meldeweg an die nationale Meldestelle (Swiss Sport Integrity).
- Jede Struktur senkt die Wahrscheinlichkeit schwerer Vorfälle und verbessert den Ausgang. Bereits angelegte Hinweise aus Etappe 1 (z.B. Fahrt allein mit einem Kind) werden wirksam.

### Heikle Fälle
- **Fallakten** als neues Objekt: Thema, Beteiligte, Warnsignale, Verlauf, Status, Dokumentation.
- Themen gemäss Konzept: Mobbing, Rassismus, Bevorzugung, Grenzverletzung, Verdacht auf Übergriff.
- **Prinzipien verbindlich:** nichts explizit darstellen (nur Hinweise, Aussagen, Gefühle, Folgen); Warnsignale tauchen zuerst klein auf; Ignorieren lässt eskalieren; richtiges Handeln (zuhören, ernst nehmen, Kind schützen, nicht selbst ermitteln, Vertrauensperson und Meldestelle einbeziehen, dokumentieren, Eltern korrekt informieren) wird belohnt; Vertuschen, Täter-Opfer-Umkehr und voreilige Anschuldigungen haben Folgen; vertuschte Fälle kehren verstärkt zurück.
- Fälle laufen über mehrere Wochen, mit Dialogen (Etappe 2) und Ereignissen.
- **Nachbesprechung** nach jedem Fall: was gut war, was besser geht, mit Hinweis auf echte Anlaufstellen.
- Bewertungskriterium «Umgang mit heiklen Fällen» (5 %) wird aktiv.
- Hinweis im Spiel (Startbildschirm/Einstellungen): Anlaufstellen für Betroffene, Möglichkeit, heikle Themen in der Darstellung abzuschwächen.

### Fairplay
- Fairplay-Wert pro Kind (seit Etappe 1 im Datenmodell) wirkt: Reklamationen, Strafen, Spielsperren, Ärger mit dem Verband. Gegenmittel: Fairplay-Theorie im Training, Teamregeln, Vorbild von Trainer:innen und Eltern an der Bande. Gutes Fairplay stärkt Ruf und Teamklima; in der U9 zählt es statt einer Rangliste.

### Sanitätsmaterial
- Zu Saisonbeginn und vor Turnieren die Sanitätstasche zusammenstellen: Auswahl aus einer Liste (Kühlpacks, Verbandmaterial, Pflaster, Desinfektion, Tape, Rettungsdecke, Handschuhe, Notfallnummern, Notfallblatt mit Allergien und Elternkontakten), Mengen und Ablaufdaten beurteilen.
- Fehlt etwas, verläuft ein späteres Verletzungsereignis schlechter; zu viel kostet Budget. Erste-Hilfe-Kurs für Trainer:innen verbessert alle Verletzungsereignisse.

### Inhalte
- Mindestens 6 Fallverläufe (je mehrere Stufen), 10 neue Ereignisse (J+S, Fairplay, Verletzungen), Dialoge für Fallgespräche.

## Oberfläche
- Bildschirm J+S: Meldungen, Anerkennungen und Ablaufdaten, Kursplanung, J+S-Coach.
- Bildschirm Prävention: Strukturen mit Status, Vertrauensperson, Fallakten (vertraulich, mit Dokumentation).
- Sanitätstasche als Auswahl-/Prüf-Bildschirm.
- Fairplay pro Team und Kind.

## Nicht in Etappe 4

Cloud, Login, Liga.

## Qualität

- Vitest: J+S-Beiträge und Verfall, Meldefehler, Präventionswirkung auf Fall-Wahrscheinlichkeit, Fall-Eskalation bei Ignorieren, Bewertung «heikle Fälle», Fairplay-Strafen, Sanitätstasche-Auswirkung, Migration 3 → 4.
- Inhaltliche Prüfung: kein Text beschreibt Übergriffe explizit (Review-Checkliste in `docs/entscheide.md`).
