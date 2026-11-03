# Prompt für Claude Code – Juniorenmanager, Etappe 6

Etappen 1–5 sind umgesetzt (Vollversion mit Cloud). Lies zuerst `CLAUDE.md`, `docs/spielkonzept.md`, `docs/entscheide.md` und diesen Prompt.

Diese Etappe: **Liga.** Mehrere Spieler:innen führen Vereine in einer gemeinsamen Region und spielen asynchron gegeneinander.

## Vor dem Start (Aufgabe der Projektleitung)

- Entscheiden: Grösse einer Liga, Zugfrist pro Woche (z.B. 24 oder 48 Stunden), Einladung per Link oder offene Ligen, Umgang mit inaktiven Spieler:innen.
- Supabase Edge Functions im bestehenden Projekt aktivieren.

## Vorgehen

1. Dokumente und Code lesen, Umsetzungsplan vorlegen, offene Fragen stellen.
2. Kleine Commits, Tests und Build nach jedem Schritt.
3. `docs/entscheide.md`, `CLAUDE.md`, `README.md` nachführen.

## Umfang Etappe 6

### Spielablauf
- Liga mit mehreren Vereinen in einer Region; gemeinsamer Kalender.
- **Wochenwechsel**, sobald alle gezogen haben oder die Frist abläuft. Wer nicht zieht, spielt mit einer Standardstrategie (Pflicht-Ereignisse mit Standardoption).
- Spiele zwischen menschlich geführten Vereinen ersetzen Spiele gegen computergesteuerte Gegner; Lücken füllen weiterhin CPU-Vereine.
- **Gemeinsamer Markt:** Kinder (über Eltern und Freundschaften) und Trainer:innen können zwischen Vereinen wechseln, abhängig von Zufriedenheit, Ruf und Distanz. Fair: kein Abwerben ohne Gegenreaktion im Spiel.
- Ranglisten der Liga zusätzlich zur Einzel-Endbewertung.

### Server
- **Spielkern läuft auf dem Server** (Supabase Edge Functions, Deno) aus demselben Code wie im Browser: `src/engine` wird ohne Änderung importiert. Der Client schickt nur Entscheide; der Server simuliert und speichert. So kann niemand schummeln.
- Liga-Simulation: Erweiterung des Spielkerns um eine Funktion für den gemeinsamen Wochenwechsel (mehrere Spielstände, gemeinsame Wettkämpfe, Markt), weiterhin rein und deterministisch, mit Seed der Liga.
- Daten: Ligen, Mitgliedschaften, Spielstände, Entscheide pro Woche (Protokoll für Nachvollziehbarkeit und Fehlersuche), RLS für alle Tabellen.
- Fristen über geplante Funktionen (Cron) auslösen.

### Kommunikation
- Liga-Übersicht mit Vereinen, Zugstatus, Frist; Benachrichtigung (im Spiel, optional E-Mail/Push), wenn eine neue Woche bereitsteht.
- Einfache, moderierbare Interaktion zwischen Spieler:innen (z.B. vordefinierte Nachrichten, Freundschaftsspiele); kein offener Chat ohne Moderationskonzept.

## Oberfläche
- Liga erstellen/beitreten (Einladungslink), Liga-Übersicht, Markt, Wochenstatus.
- Einzelspieler-Modus bleibt unverändert verfügbar.

## Qualität

- Vitest: Liga-Wochenwechsel deterministisch (gleiche Eingaben = gleiches Ergebnis auf Client und Server), Markt-Regeln, Fristablauf mit Standardstrategie, Spiele zwischen menschlichen Vereinen.
- Test, dass der Server-Code exakt den Spielkern aus `src/engine` verwendet (keine Kopie).
- Lasttest für eine Liga mit der maximalen Grösse.
