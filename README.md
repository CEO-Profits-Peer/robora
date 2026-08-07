# ROBORA

*by Lorenz Peer*

Eigene Latein-Voice-Recordings aufnehmen, im Hintergrund/bei gesperrtem Handy abspielen, und per Foto automatisch Vokabelkarten aus Vokabellisten/Grammatiktabellen erzeugen. Läuft als installierbare PWA im Browser — kostenlos (Supabase Free Tier + Gemini Free Tier).

## Setup (einmalig, ca. 10 Minuten)

### 1. Supabase-Projekt (Datenbank + Login + Audio-Speicher)

1. Auf [supabase.com](https://supabase.com) kostenlos einloggen, **New project** erstellen.
2. Unter **SQL Editor** → **New query** den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und ausführen (legt Tabellen + Sicherheitsregeln an).
3. Unter **Storage** → **New bucket** → Name `recordings`, **Public** AUS lassen (privat) → erstellen.
4. Unter **Project Settings → API**: `Project URL` und `anon public` Key kopieren.
5. Unter **Authentication → Sign In / Providers → Email**: "Confirm email" ausschalten, falls du sofort per Magic Link ohne Bestätigungsmail loggen willst (optional).

### 2. Gemini API-Key (kostenlos, für das Foto-Scan-Feature)

1. Auf [aistudio.google.com/apikey](https://aistudio.google.com/apikey) mit Google-Konto einloggen.
2. **Create API key** klicken, Key kopieren. Das ist der kostenlose Free Tier (Rate-Limits, aber für persönliche Nutzung völlig ausreichend).

### 3. Projekt konfigurieren

```bash
cp .env.example .env
```

Trage in `.env` die drei Werte ein (Supabase URL, Supabase anon key, Gemini key).

### 4. Starten

```bash
npm install
npm run dev
```

Öffnet unter `http://localhost:5173`. Am Handy: gleiches WLAN, `npm run dev -- --host` nutzen und die angezeigte Netzwerk-Adresse öffnen — oder direkt deployen (siehe unten).

## Auf dem Handy installieren

Nach dem Deployen (siehe unten) die Seite in Safari (iOS) oder Chrome (Android) öffnen → "Zum Home-Bildschirm hinzufügen". Läuft dann wie eine echte App, inkl. Wiedergabe bei gesperrtem Bildschirm (wie Spotify) über die Media Session API — solange die Seite/App nicht aktiv geschlossen wird.

## Kostenlos deployen

```bash
npx vercel
```

(oder Netlify/Cloudflare Pages). Die drei `.env`-Werte als Umgebungsvariablen im Hosting-Dashboard eintragen (gleiche Namen wie in `.env.example`).

## Funktionen

- **Aufnehmen**: Mikrofon-Aufnahme oder vorhandene Audiodatei hochladen, mit Titel + Tag (Vokabeln/Grammatik/Sonstiges).
- **Anhören**: Liste aller Aufnahmen, Mini-Player läuft app-weit weiter (auch bei gesperrtem Bildschirm), mit Wiederholen-Option (Loop).
- **Schneiden**: Aufnahmen direkt im Browser zuschneiden (Web Audio API, keine externe Software nötig).
- **Herunterladen**: Jede Aufnahme lässt sich direkt als Datei aufs Gerät herunterladen.
- **Foto-Scan**: Foto von Vokabelliste oder Grammatiktabelle → Gemini extrahiert automatisch Latein-Deutsch-Karten zum Prüfen und Speichern.
- **Vorlesen**: Vokabelkarten per Sprachausgabe (kostenlose Web Speech API des Browsers) hören — Latein zuerst oder Deutsch zuerst, wählbar, mit 1s Pause dazwischen.
- **Entdecken**: Aufnahmen, die du als "öffentlich" markierst, sind für alle Nutzer durchsuchbar/abspielbar. Vor der Freigabe prüft Gemini kurz automatisch, ob der Inhalt unangemessen ist (Quick-Check, kein Ersatz für echte Moderation).
- **Account**: Profilbild hochladen, E-Mail einsehen, Abmelden.

### Updates nachträglich einspielen

Falls du das Projekt vor einem dieser Features eingerichtet hast, einmalig im SQL Editor nachholen (bei Neuinstallation bereits in `schema.sql` enthalten):

- [`supabase/migration_2_social.sql`](supabase/migration_2_social.sql) — `is_public`-Spalte + Freigabe-Policies für "Entdecken".
- [`supabase/migration_3_avatars.sql`](supabase/migration_3_avatars.sql) — Policies für Profilbilder. Vorher zusätzlich einen **öffentlichen** Storage-Bucket `avatars` anlegen (Storage → New bucket → "Public" AN).

## Login

Per E-Mail + Passwort (mit Registrieren-Option) oder passwortlos per Magic Link — umschaltbar auf dem Login-Screen.

## Hinweis zur Sprachausgabe

Die meisten Browser haben keine eigene Latein-Stimme — die Aussprache über die Vorlese-Funktion ist daher eine Annäherung (beste verfügbare Systemstimme), nicht klassisch-korrektes Latein.

## Hinweis zum Gemini-Key

Der Key liegt im Frontend-Bundle (clientseitig sichtbar) — für ein privates Ein-Personen-Projekt unproblematisch, aber nicht für eine öffentlich beworbene App geeignet, da ihn theoretisch jeder aus dem Quellcode auslesen könnte.
