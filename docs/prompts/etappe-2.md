# Prompt für Claude Code – Juniorenmanager, Etappe 2

Wir bauen «Juniorenmanager» weiter. Etappe 1 (Kern-Simulation, Teams, Wirtschaft, Wettkampf, Ereignisse) ist umgesetzt und online. Lies zuerst `CLAUDE.md`, `docs/spielkonzept.md`, `docs/entscheide.md` und diesen Prompt.

Diese Etappe: **Eltern-Einfluss und Dialogsystem.** Eltern werden zu echten Mitspielenden, und Gespräche laufen als Dialoge mit Portrait, Stimmung und Vertrauen.

## Vorgehen

1. Lies die genannten Dokumente und den bestehenden Code (vor allem `src/engine/`).
2. Lege einen Umsetzungsplan vor und stelle offene Fragen, bevor du Code schreibst.
3. Baue in kleinen Commits; nach jedem grösseren Schritt `npm test` und `npm run build`.
4. Schema-Version erhöhen und Migration für bestehende Spielstände aus Etappe 1 schreiben (mit Test).
5. Ergänze `docs/entscheide.md` und `CLAUDE.md`.

## Verbindlich aus Etappe 1

- Spielkern bleibt rein und deterministisch: `simulateWeek(state, decisions)`, Zufall nur über `Rng`.
- Balancing-Werte in `src/content/balancing.json`, Inhalte als JSON in `src/content/`.
- Neue Spielhandlungen sind neue Varianten des Typs `Entscheid`.

## Umfang Etappe 2

### Eltern-Einfluss
- Die Elterntypen aus dem Konzept wirken spielmechanisch (engagiert, ehrgeizig, abwesend, Kritiker:in, Sponsor-Typ, potenzielle Trainer:in) über die Werte Engagement, Konfliktbereitschaft, Zahlungsmoral, Einfluss und Stimmung.
- **Ansteckung:** Stimmung breitet sich im Team aus. Eltern mit hohem Einfluss ziehen andere mit (Elternchat-Effekt); Beziehungen zwischen Familien im selben Team entstehen und verändern sich.
- **Zahlungsmoral** wirkt: Beiträge können verspätet kommen oder ausbleiben (Mahnungen im Posteingang).
- **Elternhilfe:** engagierte Eltern übernehmen Fahrdienste und kleine Aufgaben. Das senkt Transport-Probleme und Trainerbelastung, setzt aber die Eltern unter Last.
- **Potenzielle Trainer:innen:** Eltern können angefragt werden (Dialog). Wer zusagt, wird Hilfsleiter:in, mit möglichem Interessenkonflikt beim eigenen Kind (Bevorzugung, Einsatzzeit).
- **Elternabend** pro Team als planbare Massnahme (Trainingsstart oder jederzeit): Kosten Zeit/Belastung, wirkt auf Stimmung, Transparenz (Einsatzregeln) und Helferbereitschaft.
- **Abwesende Eltern:** Kind ohne Transport, sinkende Motivation; Gegenmittel Fahrgemeinschaften.

### Dialogsystem
- Datengetriebene Dialogbäume in `src/content/dialoge.json`: Knoten mit Text des Gegenübers, 3–4 Antworten, jede Antwort mit **Ton** (empathisch, sachlich, bestimmt, ausweichend), Bedingungen, Effekten und Folgeknoten.
- **Vertrauen** (−100 bis +100) als Beziehung zwischen Spieler:in und Person; Ton und Inhalt verändern Vertrauen und Ausgang. Verborgene Informationen (z.B. Talent, Grund für sinkende Motivation, Belastung zu Hause) kommen nur bei genug Vertrauen ans Licht.
- Gesprächsarten: Elterngespräch, Trainergespräch, Kindergespräch, Teamsitzung (Vorstandsgespräch folgt in Etappe 3).
- Gespräche entstehen aus Ereignissen (Ereignis-Option kann einen Dialog starten) oder werden aktiv geplant: pro Woche ein begrenztes Kontingent an Gesprächen (Zeitbudget der Spieler:in, Wert in `balancing.json`).
- Dialoge sind deterministisch: Zufall nur über den Seed; Dialogverlauf wird als Entscheid-Folge gespeichert, sodass Spielstand + Entscheide reproduzierbar bleiben.
- Nach wichtigen Gesprächen kurze Auswertung («Das hat gewirkt …»), als Vorbereitung für die Nachbesprechungen heikler Fälle in Etappe 4.
- Bestehende Ereignisse aus Etappe 1 dort, wo es passt, mit Dialogen verknüpfen (Elternbeschwerde über Einsatzzeit, Trainerstreit, Prüfungsstress, Trainer überlastet).

### Inhalte
- Mindestens 8 Dialogbäume (je mindestens 2 Ebenen) und 8 neue Ereignisse rund um Eltern, z.B. Eltern an der Bande zu laut, Fahrdienst fällt aus, Elternteil will Trainer:in werden, Kritik im Elternchat, Elternteil bietet Material an (mit Erwartung), Familie in finanziellen Schwierigkeiten, getrennt lebende Eltern mit unterschiedlichen Erwartungen, Kind will aufhören, Eltern wollen nicht.

## Oberfläche
- Dialog-Bildschirm: Portrait mit Stimmung (wechselt im Verlauf), Gesprächsverlauf, Antworten mit Ton-Symbol, Vertrauensanzeige; per Tastatur bedienbar.
- Personen-Detail: Vertrauen, bekannte und noch verborgene Informationen («?»), Gesprächsverlauf, Button «Gespräch führen».
- Eltern-Übersicht pro Team: Stimmung, Einfluss, Helferbereitschaft; Familienbeziehungen.
- Elternabend und Elternhilfe in der Teamansicht planen.

## Nicht in Etappe 2

Vorstand, Social Media, Sponsoren als System, J+S, heikle Fälle, Cloud, Liga. Das Dialogsystem muss aber so gebaut sein, dass Vorstands- und Fallgespräche später nur als Inhalte dazukommen.

## Qualität

- Vitest: Dialogverlauf deterministisch, Vertrauensänderung nach Ton, Freischalten verborgener Infos, Ansteckungsmodell (Stimmung konvergiert, bleibt in Grenzen), Zahlungsmoral-Buchungen, Migration Etappe 1 → 2.
- Probelauf über eine Saison mit passiver und mit aktiver Strategie; Kennzahlen in `docs/entscheide.md` festhalten.
