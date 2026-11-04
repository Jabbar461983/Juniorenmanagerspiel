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

## Etappe 2: Eltern-Einfluss und Dialogsystem

### Mit der Auftraggeberin / dem Auftraggeber geklärt
- **2 Gespräche pro Woche** (`dialog.gespraecheProWoche`). Gespräche aus Ereignissen zählen nicht dazu. Pro Person höchstens ein Gespräch pro Woche; derselbe Dialog mit derselben Person erst wieder nach 3 Wochen.
- **Elterntypen sind verborgen** und werden aufgedeckt durch Gespräche, Elternabende (auffällige Eltern: viel Einfluss oder hohe Konfliktbereitschaft) oder Beobachtung in Ereignissen. Rund 25 % sind zu Spielbeginn aus den «Übergabenotizen» bekannt. Konfliktbereitschaft und Zahlungsmoral werden erst mit dem Typ sichtbar. Bestehende Spielstände aus Etappe 1 behalten sichtbare Typen.
- **Ausstände mit Mahnungen:** Säumige Familien zahlen nicht, der Betrag wird zum Ausstand. Ab CHF 60 meldet sich die Kassier:in (Ereignis) mit den Optionen freundlich erinnern, formell mahnen, persönlich nachfragen (Dialog) oder abschreiben. Weitere Wege: Ratenzahlung, Härtefall.

### Technik
- **Dialoge sind Entscheide:** `{ typ: 'dialog', dialogId, personId, antworten[] }`. `dialogAuswerten()` spielt die Antworten **ohne Zufall** durch. Die Oberfläche nutzt dieselbe Funktion für die Anzeige, der Spielkern für die Anwendung. Spielstand plus Entscheide bleiben damit reproduzierbar, und ein Dialog bleibt bis «Woche simulieren» änderbar.
- Ereignis-Optionen können mit `dialog` und `dialogPerson` ein Gespräch starten. Die Oberfläche speichert dann Ereignis-Entscheid und Gespräch gemeinsam. Standardoptionen starten nie einen Dialog.
- Verzweigungen im Dialog hängen vom Vertrauen (`vertrauenAb`) oder von Bedingungen (z.B. `bereitschaftAb` für Helfer:innen) ab. Das Gegenüber «entscheidet» damit deterministisch aus seinen Werten.
- Verborgene Infos werden live aus dem Spielstand berechnet (`engine/infos.ts`). `person.bekannt` hält nur fest, was offenbart wurde.
- Die Vorschau wendet Gespräche an, Elternabende decken aber erst bei der echten Simulation Elterntypen auf (sonst liesse sich durch Planen und Absagen spicken).
- Schema-Version 2 mit Migration von Version 1.

### Spielmechanik
- **Vertrauen** (−100 bis +100) pro Person. Grundwirkung des Tons: empathisch +5, sachlich +2, bestimmt −1, ausweichend −5. Elterntyp, Konfliktbereitschaft und Charakterzüge von Kindern verändern die Wirkung (z.B. Kritiker:innen schätzen Sachlichkeit). Vertrauen verblasst um 1 % pro Woche und wirkt leicht auf die Zufriedenheit (Trainerbeziehung, Elterneinfluss). Ein Gespräch verändert die Elternstimmung um die halbe Vertrauensänderung.
- **Offenbaren** ab Vertrauen 12 im Moment der Antwort.
- **Ansteckung:** Die Elternstimmung nähert sich pro Woche um 5 % dem nach Einfluss gewichteten Teammittel und um 3 % befreundeten Eltern an. Freundschaften zwischen Familien im selben Team entstehen beim Spielstart und bei Neueintritten.
- **Zahlungsmoral:** Wöchentliche Wahrscheinlichkeit, säumig zu werden, steigt mit tiefer Zahlungsmoral und tiefem Einkommen; säumige Familien erholen sich mit 12 % pro Woche von selbst. Ratenzahlung trägt den Ausstand mit mindestens 15 % pro Woche ab. Formelles Mahnen verärgert und erhöht das Austrittsrisiko (doppelt bei tiefem Einkommen).
- **Fahrdienst:** Kinder, deren Eltern alle «abwesend» sind, kommen ohne Fahrdienst im Team seltener an Wettkämpfe (Anwesenheit ×0.6) und verlieren Motivation. Fahrdienst entlastet die Trainer:innen in Spielwochen; Helfer:innen werden ausgelastet und über 75 unzufrieden.
- **Elternabend:** höchstens 2 pro Team und Saison, CHF 60, im Trainingsstart 1.5-fache Wirkung. Setzt transparente Einsatzregeln.
- **Interessenkonflikt:** Elternteil im Trainerteam des eigenen Kindes ohne transparente Einsatzregeln: Das eigene Kind bekommt mehr Einsatzzeit, die anderen Eltern werden langsam unzufrieden.
- **Inhalte:** 14 Dialoge (Kennenlernen, Einsatzzeit, Hilfsleiter:in, Fahrdienst, Kritik im Chat, Kosten, Ausstand, Bande, Befinden Kind, Kind will aufhören, Prüfungsstress, Befinden Trainer:in, Einschätzung der Kinder, Teamsitzung) und 10 neue Ereignisse (insgesamt 25). Fünf bestehende Ereignisse sind mit Gesprächen verknüpft.

### Probeläufe (eine Saison, 4 Seeds)
| Spielweise | Ø Kinder am Ende | Ø Zufriedenheit | Ø Punkte | Ø Kasse |
| --- | --- | --- | --- | --- |
| passiv (nur Pflicht-Ereignisse, ohne Gespräche) | 43 | 66.1 | 195 | CHF 8’535 |
| aktiv (Elternabende, Fahrdienst, 2 Gespräche/Woche, Ereignis-Gespräche) | 48 | 68.4 | 229 | CHF 7’724 |

Aktive Elternarbeit lohnt sich spürbar, ohne übermächtig zu sein. Ausstände liegen bei CHF 100–270 pro Saison.

## Etappe 3: Vorstand, Social Media, Sponsoren, Geldbeschaffung

### Mit der Auftraggeberin / dem Auftraggeber geklärt
- **Vorzeitiges Spielende streng, mit Lernmodus:** Absetzung (Einfluss unter 10), Budgetkonkurs und Auflösung (4 Wochen ohne spielfähiges Team: mindestens 6 Kinder und 1 Trainer:in) beenden das Spiel. Beim Start wählbar: **Lernmodus** ohne vorzeitiges Ende; Warnungen erscheinen trotzdem.
- **Alte Spielstände laufen weiter:** Die Migration 2 → 3 entfernt das «Ende der spielbaren Version» aus Etappe 1/2. Ab jetzt gilt die gewählte Laufzeit (Standard 5 Saisons).

### Technik
- Neue Module: `engine/vorstand.ts`, `engine/social.ts`, `engine/sponsoren.ts`, `engine/anlaesse.ts`, `engine/bewertung.ts`. Inhalte: `content/aktivitaeten.json`, `content/verein.json` (Ämter, Prioritäten, fiktive Sponsoren).
- Vorstandsmitglieder sind Personen (`rolle: 'vorstand'`) und nutzen das Dialogsystem (`art: 'vorstand'`).
- Ereignisvorlagen können mit `erzeugt: 'sponsorAngebot'` beim Auslösen ein Angebot anlegen; `ausloeser.bedingung` erlaubt Sonderregeln (`sponsorAnfrage`, `nichtLernmodus`).
- `migriere()` arbeitet auf einer Kopie (vorher wurde der Rohstand verändert). Die Migration 2 → 3 erzeugt den Vorstand mit eigenem, aus dem Seed abgeleitetem Zufall und bleibt deterministisch.
- Schema-Version 3.

### Spielmechanik
- **Vorstand:** fünf Ämter (Präsidium, Kasse, Sportchef:in, Kommunikation, Beisitz) mit Haltung (−100 bis +100; ab +30 Unterstützer:in, ab −30 skeptisch) und Priorität (zu Beginn verborgen, im Gespräch erfahrbar).
- **Sitzung alle 4 Wochen** (absolute Woche durch 4 teilbar), höchstens 2 Anträge, maximal CHF 3’000 pro Antrag. Zustimmung pro Mitglied: Sigmoid aus Haltung, Einfluss, Vorbereitung, Betrag, Priorität und Kassenlage. Jeder in der Saison bereits genehmigte Antrag senkt die Zustimmung (Antragsmüdigkeit). Bei Stimmengleichheit entscheidet das Präsidium. Hallenzeiten bringen −30 % Hallenmiete für den Rest der Saison.
- **Vorbereitung:** Bericht (+12, einmal pro Woche) und Einzelgespräche (+3 bis +6), höchstens 30 Punkte; nach der Sitzung wieder 0.
- **Einfluss** monatlich aus Mitgliederentwicklung, Zufriedenheit, Ruf, Verbündeten/Skeptiker:innen, Kasse; zieht zur Mitte zurück (25 % der Abweichung von 50), höchstens ±5 pro Sitzung. Dazu: Finalturniersieg +4, U18-Meistertitel +8, angenommener Antrag +0.5, abgelehnter −2/−4, Kasse im Minus −0.5 pro Woche. Haltungen ziehen ebenfalls langsam zur Mitte.
- **GV in Woche 50:** Jahresbudget = 4’500 × (0.6 + 0.8 × Einfluss/100) + 40 pro Kind, minus Kürzungen; Buchung in Woche 1 der nächsten Saison (ersetzt den pauschalen Vereinsbeitrag). Ab Einfluss 60 wirst du in den Vorstand gewählt und stimmst mit.
- **Konkurs-Kette:** 2 Wochen im Minus → Pflicht-Ereignis «Massnahmen»; 6 Wochen → 30 % Kürzung des nächsten Jahresbudgets, Einfluss −8; 12 Wochen ohne Rettungsplan (20 mit Rettungsplan) → Absetzung. Rettungsplan entsteht durch Sparprogramm, eine gestartete Aktion oder ein Gespräch mit der Kasse.
- **Geldbeschaffung:** 7 Aktionen mit Vorbereitungszeit, Helfer:innen aus dem Pool (Eltern mit Rolle «Anlässe» oder Engagement ≥ 15), Kosten, Ertrag und Risiko. Fehlende Helfer:innen senken den Ertrag; dieselben Helfer:innen in parallelen Aktionen werden überlastet.
- **Sponsoren:** Anfragen hängen von Reichweite und Ruf ab, aktive Suche verdreifacht sie für 4 Wochen, jeder laufende Vertrag senkt sie (Marktsättigung 0.55). Betrag CHF 400–2’000 pro Saison, Laufzeit 1–3 Saisons. Social-Media-Gegenleistungen summieren sich (2 Posts pro Monat und Sponsor). Verlängerung ab Zufriedenheit 50. Firmen von Eltern bergen Bevorzugungsrisiko ohne transparente Einsatzregeln.
- **Social Media:** Reichweite 0–100 (Start 20, Zerfall 3 % pro Woche), höchstens 2 Posts pro Woche. Wirkung nach Inhalt, Bildern (ohne 0.6, nur mit Einwilligung 0.9, alle 1.2) und Grundfrequenz der Kommunikationsperson. Posts mit allen Bildern können bei fehlender Einwilligung (75 % der Familien willigen ein) ein Pflicht-Ereignis auslösen. Der Ruf zieht ohne neue Impulse langsam zur Mitte.
- **Trainerquellen:** Motivierte U18-Abgänger:innen werden mit 35 % Wahrscheinlichkeit Hilfsleiter:innen im Trainerpool; dazu das Ereignis «Interesse am Trainerjob» (häufiger bei gutem Ruf). Ohne diese Quelle schrumpften die Trainerteams über mehrere Saisons.
- **Nachwuchswelle:** Im Trainingsstart melden sich jede Woche mit hoher Wahrscheinlichkeit 6- bis 9-Jährige zum Schnuppern. Ohne sie schrumpfte die Abteilung über 5 Saisons auf rund die Hälfte.
- **Endbewertung (0–100):** aktive Junior:innen 35 % (100 × (1 − e^(−n/60))), Zufriedenheit 35 %, Ruf und Einfluss 10 %, Trainerstruktur 10 % (Anzahl, Generationen- und Geschlechter-Mix, J+S-Anerkennung), heikle Fälle 5 % (bis Etappe 4 neutral 50), Finanzen 5 %. Titel ab 75 «Herzensverein», 65 «Talentschmiede», 55 «Solide Abteilung», 45 «Baustelle mit Potenzial». Gilt auch als Saisonbewertung.
- **Inhalte:** 12 neue Ereignisse (insgesamt 37), 6 Vorstands-Dialoge (insgesamt 20).

### Probeläufe (5 Saisons, 4 Seeds)
| Spielweise | Ø Kinder nach 5 Saisons | Ø Zufriedenheit | Ø Punkte | Ø Kasse |
| --- | --- | --- | --- | --- |
| passiv (nur Pflicht-Ereignisse) | 34 | 62.8 | 52.7 | CHF 12’250 |
| aktiv (Trainer zuteilen, Anträge mit Bericht, Posts alle 2 Wochen, 2 Aktionen pro Saison, Sponsoren annehmen) | 76 | 67.7 | 72.1 | CHF 83’000 |

### Offen
- Bei sehr aktiver Spielweise sammelt sich viel Geld an, weil es noch wenige Ausgabemöglichkeiten gibt. Mit Etappe 4 kommen J+S-Kurse, Weiterbildung, Prävention und Sanitätsmaterial dazu; danach Balancing der Finanzen neu prüfen (evtl. Lager/Turniere als Ausgaben).
- Passive Spielweise kann je nach Seed stark schrumpfen (ein Seed: 14 Kinder nach 5 Saisons), weil niemand Trainer:innen zuteilt. Das ist gewollt, die Übersicht weist darauf hin.
