# Project Progress – Serverbereich

Der aktive Einstieg `src/ServerApp.jsx` verwendet Supabase Auth, Postgres mit RLS und den privaten Bucket `task-media`. Die frühere Browser-Demo in `src/App.jsx` bleibt als Quellstand erhalten, wird aber nicht automatisch geöffnet. Bestehende lokale Demo-Daten werden weder gelöscht noch automatisch hochgeladen.

## Nutzung

- Persönlichen E-Mail-Link anfordern; nur vorhandene Konten sind zugelassen.
- Projektmanager sehen ihre Projekte, Aufgaben und die Ressourcenverwaltung.
- Ressourcenbenutzer sehen ausschließlich freigegebene, zugewiesene Aufgaben.
- In der Ressourcenverwaltung kann der Projektmanager vorhandene Benutzer per E-Mail verbinden oder neue einladen und Ressourcenzugriff sperren/freigeben. Projekteigentümer behalten ihre Eigentümerrechte unabhängig von der Ressourcenfreigabe.
- Fortschrittsmeldungen mit Kommentaren und bis zu zehn Fotos/Videos (je 50 MB) werden auf dem Server gespeichert. Bei einem Uploadfehler bleibt die Meldung erhalten; nur ausstehende Dateien werden erneut übertragen.
- Der XML-Import verwendet die vorhandene transaktionale Serverfunktion und erhält Benutzerzuordnungen sowie historische Meldungen. Datumsvorschau vor dem Übernehmen prüfen.
- Projekt-/Mediendaten und Sitzungen werden nicht dauerhaft im Browser gespeichert. Nach Neuladen ist ein neuer Anmeldelink erforderlich. Die frühere Demo darf nicht als Produktionsspeicher verwendet werden.

`.env.production` enthält ausschließlich die öffentliche Projektadresse und einen Publishable Key. Service-Role-Schlüssel gehören ausschließlich in die Edge-Function-Umgebung.

## Prüfstand 2026-11-05

Produktionsbuild erfolgreich. Datenbankprüfung mit `authenticated` und Benutzer-ID, jeweils in zurückgerollten Transaktionen: Ressourcenbenutzer sieht 1 Projekt / 1 Ressource / 3 Aufgaben; Projektmanager sieht 1 / 7 / 25. Gesperrter Ressourcenbenutzer sieht 0 Projekte / Aufgaben. Eigene Meldung zugelassen, Meldung unter fremder Ressource abgelehnt. Die Browser-Vorschau war in dieser Arbeitsumgebung nicht erreichbar; der vollständige Anmelde-/Uploadablauf benötigt noch einen echten Benutzertest.

## Entwicklung

`npm ci` und `npm run build`. Inhalt von `dist/` auf GitHub Pages unter `/Project-progress/` veröffentlichen.
