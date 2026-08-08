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

Besucherzahlen: [Vercel Analytics](https://vercel.com/docs/analytics) ist eingebaut und kostenlos (Free-Tier-Limit: 2.500 Events/Monat) — im Vercel-Dashboard unter dem Projekt-Tab "Analytics" einmalig aktivieren, dann siehst du dort Besucherzahlen & aufgerufene Seiten. Kein Code nötig, läuft automatisch.

## Funktionen

- **Aufnehmen**: Mikrofon-Aufnahme oder vorhandene Audiodatei hochladen, mit Titel + Tag (Vokabeln/Grammatik/Sonstiges).
- **Anhören**: Liste aller Aufnahmen, Mini-Player läuft app-weit weiter (auch bei gesperrtem Bildschirm), mit Wiederholen-Option (Loop).
- **Schneiden**: Aufnahmen direkt im Browser zuschneiden (Web Audio API, keine externe Software nötig).
- **Herunterladen**: Jede Aufnahme lässt sich direkt als Datei aufs Gerät herunterladen.
- **Foto-Scan**: Foto von Vokabelliste oder Grammatiktabelle → Gemini extrahiert automatisch Latein-Deutsch-Karten zum Prüfen und Speichern.
- **Vorlesen**: Vokabelkarten per Sprachausgabe (kostenlose Web Speech API des Browsers) hören — Latein zuerst oder Deutsch zuerst, wählbar, mit 1s Pause dazwischen.
- **Entdecken**: Aufnahmen, die du als "öffentlich" markierst, sind für alle Nutzer durchsuchbar/abspielbar, mit Filter "Alle"/"Folge ich". Vor der Freigabe prüft Gemini kurz automatisch, ob der Inhalt unangemessen ist (Quick-Check, kein Ersatz für echte Moderation).
- **Profile & Folgen**: Klick auf ein Profilbild öffnet eine eigene Profilseite mit Avatar, Namen und allen öffentlichen Aufnahmen dieser Person — inkl. Folgen/Entfolgen-Button.
- **Speichern**: Aufnahmen anderer per Lesezeichen-Icon merken, unter "Gespeichert" in Anhören wiederfinden.
- **Quiz-Modus**: Spaced-Repetition-Abfrage deiner Vokabelkarten (vereinfachtes SM-2) — fällige Karten werden abgefragt, Wiederholintervall passt sich automatisch an dein Ergebnis an.
- **Likes**: Herz-Icon auf öffentlichen Aufnahmen, mit sichtbarem Zähler.
- **Gruppen**: Lerngruppe per Einladungscode erstellen/beitreten, Aufnahmen & Vokabelkarten gezielt mit der Gruppe teilen. Eigener Live-Chat pro Gruppe (Text + Bild, per Supabase Realtime, ohne Neuladen).
- **Account**: Profilbild + Name hochladen, E-Mail einsehen, Abmelden.

### Updates nachträglich einspielen

Falls du das Projekt vor einem dieser Features eingerichtet hast: einmalig [`supabase/all_migrations.sql`](supabase/all_migrations.sql) komplett in den SQL Editor einfügen und ausführen — bündelt alles unten in einem Rutsch (bei Neuinstallation nicht nötig, ist bereits in `schema.sql` enthalten). Alle Migrationen sind idempotent (können gefahrlos mehrfach ausgeführt werden).

Einzeln, falls du gezielt nur ein Feature nachrüsten willst:

- [`supabase/migration_2_social.sql`](supabase/migration_2_social.sql) — `is_public`-Spalte + Freigabe-Policies für "Entdecken".
- [`supabase/migration_3_avatars.sql`](supabase/migration_3_avatars.sql) — legt den `avatars`-Bucket per SQL an (kein Dashboard-Klick nötig) + Policies für Profilbilder.
- [`supabase/migration_4_profiles.sql`](supabase/migration_4_profiles.sql) — öffentliche `profiles`-Tabelle (Avatare anderer Nutzer sichtbar machen).
- [`supabase/migration_5_name_saved.sql`](supabase/migration_5_name_saved.sql) — Account-Name + "Gespeichert"-Feature.
- [`supabase/migration_6_spaced_repetition.sql`](supabase/migration_6_spaced_repetition.sql) — Spalten für den Quiz-Modus.
- [`supabase/migration_7_follows.sql`](supabase/migration_7_follows.sql) — Follow-System.
- [`supabase/migration_8_likes.sql`](supabase/migration_8_likes.sql) — Likes.
- [`supabase/migration_9_groups.sql`](supabase/migration_9_groups.sql) — Gruppen zum Teilen von Aufnahmen & Vokabelkarten.
- [`supabase/migration_10_fix_group_rls.sql`](supabase/migration_10_fix_group_rls.sql) — Fix für eine Endlosrekursion in den Gruppen-Policies.
- [`supabase/migration_11_group_chat.sql`](supabase/migration_11_group_chat.sql) — Live-Chat (Text + Bild) innerhalb von Gruppen.

### Hinweis zu Gruppen

Der Gruppen-Chat hat keine automatische Inhaltsmoderation (anders als "Entdecken", das öffentlich ist) — er ist nur für eingeladene Mitglieder sichtbar, ähnlich einem privaten Messenger-Chat.

## Login

Per E-Mail + Passwort (mit Registrieren-Option), passwortlos per Magic Link, oder mit Google — umschaltbar auf dem Login-Screen.

### Google-Login aktivieren (optional, kostenlos)

Ohne diesen Schritt zeigt der "Mit Google anmelden"-Button einen Fehler. Einmalig einrichten:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → neues Projekt (oder bestehendes nutzen) → **OAuth consent screen** einmal durchklicken (External, App-Name z.B. "ROBORA", deine E-Mail als Kontakt).
2. **Credentials → Create Credentials → OAuth client ID** → Typ "Web application".
3. In Supabase unter **Authentication → Providers → Google** die **Callback-URL** kopieren (Format `https://<projekt>.supabase.co/auth/v1/callback`) und bei Google unter "Authorized redirect URIs" eintragen.
4. Den generierten **Client ID** + **Client Secret** von Google zurück in Supabase bei **Authentication → Providers → Google** eintragen und den Provider aktivieren.
5. Fertig — kein Code-Änderung nötig, der Button funktioniert direkt.

## Hinweis zur Sprachausgabe

Die meisten Browser haben keine eigene Latein-Stimme — die Aussprache über die Vorlese-Funktion ist daher eine Annäherung (beste verfügbare Systemstimme), nicht klassisch-korrektes Latein.

## Hinweis zum Gemini-Key

Der Key liegt im Frontend-Bundle (clientseitig sichtbar) — für ein privates Ein-Personen-Projekt unproblematisch, aber nicht für eine öffentlich beworbene App geeignet, da ihn theoretisch jeder aus dem Quellcode auslesen könnte.
