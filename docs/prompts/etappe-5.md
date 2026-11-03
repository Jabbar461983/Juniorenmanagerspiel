# Prompt für Claude Code – Juniorenmanager, Etappe 5

Etappen 1–4 sind umgesetzt; das Spiel ist inhaltlich vollständig. Lies zuerst `CLAUDE.md`, `docs/spielkonzept.md`, `docs/entscheide.md` und diesen Prompt.

Diese Etappe: **Cloud-Speicherung mit Supabase und Login.** Spielstände sind auf jedem Gerät verfügbar. Der Spielkern bleibt unverändert.

## Vor dem Start (Aufgabe der Projektleitung)

- Supabase-Konto und Projekt anlegen (Region Europa). Projekt-URL und den öffentlichen `anon`-Schlüssel bereitstellen.
- Entscheiden, welche Login-Arten erlaubt sind (E-Mail-Link, Passwort, evtl. Google/Apple).
- Datenschutzerklärung (Schweizer DSG) bereitstellen oder durch Claude entwerfen lassen und prüfen.

## Vorgehen

1. Dokumente und Code lesen, Umsetzungsplan vorlegen, offene Fragen stellen.
2. Kleine Commits, Tests und Build nach jedem Schritt.
3. `docs/entscheide.md`, `CLAUDE.md` und `README.md` (Einrichtung Supabase, Umgebungsvariablen, GitHub-Secrets) nachführen.

## Umfang Etappe 5

### Speicherung
- `SupabaseRepository` erfüllt das bestehende Interface `SaveRepository` **ohne Änderungen am Spielkern**.
- Tabellen und Row Level Security als SQL-Migrationen im Repo (`supabase/migrations/`): Spielstände gehören genau einer Person; niemand sonst kann sie lesen oder schreiben.
- Spielstand als JSONB mit Metadaten (Name, Verein, Saison, Woche, Schema-Version, Zeitstempel).
- **Offline zuerst:** IndexedDB bleibt der lokale Speicher; Synchronisation mit der Cloud im Hintergrund. Konfliktregel bei zwei Geräten klar definieren (z.B. neueste Woche gewinnt, mit Nachfrage bei echtem Konflikt).
- Bestehende lokale Spielstände beim ersten Login in die Cloud übernehmen (mit Bestätigung).
- Schema-Migrationen gelten auch für geladene Cloud-Spielstände.

### Login
- Supabase Auth, Login optional: ohne Login weiterhin rein lokal spielbar.
- Konto-Bildschirm: angemeldet als …, abmelden, Konto und alle Daten löschen.

### Technik
- Konfiguration über Umgebungsvariablen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); im GitHub-Workflow über Repository-Secrets bzw. -Variablen.
- Keine geheimen Schlüssel im Client oder im Repo (nur `anon`-Schlüssel mit RLS).
- Fehler- und Offline-Zustände sichtbar machen (Sync-Symbol, letzte Synchronisation).

## Oberfläche
- Speichern/Laden zeigt lokale und Cloud-Spielstände mit Sync-Status.
- Login- und Konto-Bildschirm; Hinweis zum Datenschutz.

## Nicht in Etappe 5

Liga, serverseitige Simulation, Mehrspieler.

## Qualität

- Vitest: `SupabaseRepository` gegen einen Mock des Supabase-Clients, Sync- und Konfliktlogik, Import lokaler Stände.
- RLS-Regeln mit einem SQL-Test oder dokumentiertem manuellen Testprotokoll prüfen.
- Bestehende Tests des Spielkerns bleiben unverändert grün.
