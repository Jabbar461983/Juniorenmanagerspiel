# Entscheide während der Umsetzung

Laufende Liste von Entscheiden, die über das Spielkonzept hinausgehen. Neueste unten ergänzen.

## Etappe 1

### Mit der Auftraggeberin / dem Auftraggeber geklärt
- **Speicherung lokal in IndexedDB** (statt localStorage), hinter dem `SaveRepository`-Interface; Fallback ohne Persistenz, falls IndexedDB blockiert ist.
- **Startbudget frei einstellbar**, Standard CHF 15’000. Zusätzlich Schwierigkeitsstufen als Vorwahl: Leicht 25’000, Normal 15’000, Schwer 10’000.

### Technik
- Aktuelle Versionen: Vite 8, React 19, TypeScript 7 (strict, `noUncheckedIndexedAccess`), Vitest 5, vite-plugin-pwa 2.
- Kein Router: Navigation über einen einfachen Zustand in `App.tsx` (wenige Bildschirme, keine Deep-Links nötig).
- Base-Pfad über Umgebungsvariable `BASE_PATH` (Workflow setzt `/<repo>/`), lokal `/`.
- `simulateWeek` klont den Spielstand per JSON-Rundreise; einfach, garantiert serialisierbar und schnell genug.
- Entscheide werden in der UI als **Wochen-Entwurf** gesammelt. Die Oberfläche zeigt eine Vorschau (`vorschau()`), angewendet wird alles erst in `simulateWeek`. Dadurch reichen später Spielstand + Entscheidliste für eine serverseitige Simulation (Liga).
- Ereignisse werden **am Ende einer Woche für die nächste Woche** erzeugt. Antworten sind Teil der Entscheide der nächsten Simulation. Freiwillige Ereignisse ohne Antwort werden nach 2 Wochen mit der Standardoption erledigt.
- «Gelesen» im Posteingang ist kein Spielentscheid und wird direkt im Spielstand gesetzt.

### Spielmechanik
- **Saisonstart:** Montag, der dem 1. Juni am nächsten liegt; 52 Wochen. Phase pro Woche über den Mittwoch bestimmt; die letzten 4 Wochen sind immer «Abschluss».
- **Ferien Kanton Bern** als gerundete Richtwerte (Sommer 4.7.–9.8., Herbst 26.9.–18.10., Winter 24.12.–4.1., Sport 7.–15.2., Frühling 4.–19.4.), anpassbar in `content/ferien.json`.
- **Alter/Stufe nach Jahrgang:** Alter = Saisonstartjahr − Geburtsjahr. Übertritte am Saisonende, Kinder über 17 wechseln als U18-Abgänger:innen zu den Aktiven.
- **Wettkampf startet** in der ersten Meisterschaftswoche mit den dann vorhandenen Teams. Neue Teams gründen und Teams auflösen ist nur vorher möglich. Hat eine Stufe zwei Teams, spielen beide in derselben Liga (weniger Gegnerteams).
- **Liga U12/U15:** pro Turnier 3 Runden aus dem Jeder-gegen-jeden-Plan (rotierend). Finalturnier der Top 6 als Jeder gegen jeden in der zweiten Abschlusswoche.
- **U18:** 18 Runden (Hin/Rück) verteilt auf die Meisterschaftswochen ohne Ferien; in manchen Wochen zwei Runden. **Playoffs** ab der ersten Woche im März: 1–8, 2–7, 3–6, 4–5; Halbfinal/Final neu nach Setzliste. Pro Woche Spiel 1 und 2 einer Serie, ein allfälliges Spiel 3 in der Folgewoche; die nächste Runde beginnt in der Woche danach. Unentschieden in Playoffs werden in der Verlängerung entschieden.
- **Spielstärke:** Schnitt aus Technik/Kondition/Spielverständnis der besten anwesenden Spieler:innen + Trainer-Fachwissen + Tagesform (Normalverteilung) + kleiner Heimvorteil; Tore Poisson-verteilt.
- **Einsatzzeit:** abhängig von Kadergrösse und Stufe (U15/U18 leistungsabhängiger); transparente Einsatzregeln (Ereignis «Beschwerde über Einsatzzeit») glätten die Verteilung.
- **Team-Wert:** pro Skill Gewichte 1 / 0.3 / 0.15 / 0.1 nach Rang; ab der dritten Person mit gleichem Schwerpunkt nur noch 20 %; Rollenbonus 10 % auf den Schlüsselskill der Rolle; ohne Haupttrainer:in −15 % Organisation.
- **Zufriedenheit:** Faktoren wie im Konzept (25/20/20/15/10/10 %). Wöchentliche Annäherung mit 0.2. Siege/Niederlagen wirken als kleine einmalige Effekte.
- **Austritte:** wöchentlich geringe Basis, stark steigend unter 40; Hauptfenster in Woche 52 (nach Zufriedenheit gestaffelt). Höhere Beiträge erhöhen Austritte (Elastizität), Familien mit tiefem Einkommen stärker – Härtefallfonds/Härtefall reduziert das.
- **Eintritte:** Anwerbung, Mund-zu-Mund (Kinder mit Zufriedenheit > 70) und spontane Anfragen erzeugen Schnupperkinder. Nach 2 Wochen bleiben sie mit einer Wahrscheinlichkeit aus erstem Eindruck (Zufriedenheit) und Beitrag.
- **Finanzen:** Beiträge wöchentlich anteilig (Jahresbeitrag/52). Verbandsgebühren beim Meisterschaftsstart (pro Team + Lizenz pro Kind ab U12). Ab Saison 2 ein Jahresbeitrag des Gesamtvereins (Platzhalter bis zum Vorstand in Etappe 3). Kasse 2 Wochen unter null → Warnung im Posteingang.
- **Trainer:innen:** Belastung steigt mit Trainings (besonders über der eigenen Verfügbarkeit) und Wettkämpfen, sinkt jede Woche und in den Ferien stärker. Sehr hohe Belastung oder tiefe Motivation kann zum Rücktritt führen.
- **Bewertung (vorläufig):** Summe über alle aktiven Kinder von 10 × (Zufriedenheit/100)². So schneiden 100 Kinder mit 80 besser ab als 150 mit 40. Titel-Schwellen in `balancing.json`.
- **Etappe 1 endet nach einer Saison** (`spiel.etappeMaxSaisons = 1`); die gewählte Laufzeit wird gespeichert und gilt, sobald dieser Wert erhöht wird.
- Talent bleibt verborgen; erfahrene Trainer:innen im Team (Erfahrung ≥ 14) liefern eine grobe Einschätzung.

### Offen / für spätere Etappen notiert
- Balancing ist ein erster Wurf auf Basis von Probeläufen (passive Spielweise: ca. 40–50 Kinder, Zufriedenheit 60–67 am Saisonende). Werte nach Testspielen justieren.
- J+S-Regeln (Kursnamen, Altersgrenzen, Beiträge) sind noch nicht an offiziellen Unterlagen geprüft – betrifft Etappe 4.
- Zahlungsmoral der Eltern ist im Datenmodell, wirkt aber noch nicht.
