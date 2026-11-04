# Prüfbericht – Serverbasierte Projektfortschritts-App
Stand: 04.11.2026 · Pull Request #9 (Entwurf, nicht gemergt)

## Automatisierte Prüfungen
- GitHub Actions: `Verify server workspace` führt `npm ci`, XML-Regressionsprüfungen, `npm run lint`, `npm run build` aus.
- XML-Testfälle: verschachtelte MS-Project-Gliederung, doppelte UID, verwaiste Ebene, nicht-summarischer Elternvorgang, Ebenensprung, DOCTYPE-Abwehr, leere Datei, Importvorschau und Europe/Berlin-Zeitabgleich.
- CI ist Voraussetzung vor jeder Freigabe; Verlauf unter GitHub Actions.

## Original-Datei – strukturell geprüft (nicht in das öffentliche Repository kopiert)
- MS-Project-XML mit 25 importierbaren Vorgängen (ohne UID 0), 8 Ressourceneinträgen und 21 Zuordnungen.
- Keine doppelten Vorgangs-UIDs oder ungültigen Zuordnungen.
- Eine zusätzliche Ressource ohne Zuordnungen; bestehende Datenbank enthält 7 verwendete Ressourcen und 21 Zuordnungen.
- Format und Gliederung entsprechen dem Importparser.

## Supabase-Datenbanktests – erfolgreich, jeweils ROLLBACK
1. Projektverantwortlicher importiert 2 neue Testvorgänge; erneuter Import ändert einen Vorgang, erhält dieselbe UUID.
2. Simulation mit Original-Projektdaten (25 Vorgänge): importieren, umbenennen, hinzufügen, einen Vorgang inaktiv setzen; historischer Fortschrittsbericht und Medienmetadaten bleiben per UUID erhalten; dritter identischer Import ist idempotent.
3. Nicht berechtigter Benutzer sieht keine Projekte/Vorgänge/Meldungen/Medien und darf keinen Import ausführen.
4. Temporärer Ressourcenbenutzer sieht nur seine Vorgänge/Meldungen/Medien; nach Sperrung sind auch historische Nachweise nicht mehr zugänglich.
5. Ungültige Imports (doppelte UID, fehlender Elternvorgang, nicht-summarischer Elternvorgang) werden abgewiesen und verändern keine Daten.
6. Zeitstempel 27.10.2026 08:00 Uhr Europe/Berlin wird als 07:00 UTC persistiert.
7. Freigabe und Sperrung von Ressourcen erzeugen atomare Audit-Einträge.

## Sicherheit und Betrieb
- RLS-Rekursion der Aufgaben-Zugriffsregeln durch ein privates Berechtigungs-Hilfsverfahren behoben.
- Historische Berichte und Medien folgen aktuellen Ressourcenrechten; kein Ausnahmerecht für frühere Autoren nach Sperrung.
- Tabellen-Schreibrechte sind durch RLS begrenzt.
- Privater Bucket `task-media`, 50 MiB Upload-Grenze und eingeschränkte erlaubte MIME-Typen.
- Automatische Bereinigung verwaister Uploads über Storage-API mit eingeschränkter Löschrichtlinie vorgesehen.
- Supabase-Funktion ist in `supabase/sql/atomic_ms_project_plan_import.sql` versioniert; weitere Sicherheitsregeln in `supabase/sql/`.
- Veröffentlichung bleibt unangetastet; Server-Vorschau ist im Pull Request isoliert.
- Verifikationsabfrage nach Datenbanktests: 1 Projekt, 25 aktive Vorgänge, 7 verwendete Ressourcen, 21 Zuordnungen, 0 Testreste.

## Noch nicht verifiziert – produktive Freigabe gesperrt
- **Echter Browser-End-to-End-Test:** Es existieren derzeit keine mit Auth-Benutzerkonten verknüpften Ressourcen. Anmeldung und Rechte im realen Browser lassen sich deshalb nicht vollständig testen.
- **Medien-Byte-Upload:** Der private Storage-Bucket und die RLS-Regeln sind geprüft, aber ein echter Kamera-/Archiv-Upload mit Auth-Sitzung, anschließender Anzeige und Löschbereinigung ist noch nicht durchgeführt.
- **Produktivkonfiguration:** `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` müssen für den späteren Pages-Build bereitgestellt und im Browser geprüft werden. Ohne Konfiguration wird die Serveransicht bewusst nicht gestartet.
- **Reimport geänderter Ressourcenzuordnungen:** Die vorhandenen 21 Zuordnungen stimmen strukturell mit der Originaldatei überein. Die aktuelle XML-Importfunktion aktualisiert nur Vorgänge, nicht geänderte MS-Project-Ressourcen/Zuordnungen.
- **Passwortschutz:** Supabase Security Advisor meldet deaktivierte Erkennung kompromittierter Passwörter. In Supabase Auth-Einstellungen aktivieren.
- **Live-Geräteprüfung:** iPhone-Kamera, iPad-Dateiauswahl und Desktop-Browser müssen mit realen Testzugängen getestet werden.
- **Produktivfreigabe:** Erst nach obigen Live-Tests, bestandenem CI und Review des Pull Requests.

## Datenschutz
Echte Nutzerdateien, temporäre Kennwörter und Testmedien werden nicht in das öffentliche GitHub-Repository übernommen. Tests an der produktiven Datenbank fanden in vollständig zurückgerollten Transaktionen statt.
