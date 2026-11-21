# 🥨 Schülerverkauf – Abstimmung

Schüler stimmen **ohne Anmeldung** ab, was es beim Schülerverkauf geben soll, und schreiben Wünsche für nächste Woche.
Auf der **Admin-Seite** legst du die Produkte an, siehst die Stimmen und Wünsche und setzt die Stimmen per Knopfdruck auf 0.

- `index.html` → Seite für die Schüler
- `admin.html` → deine Admin-Seite (mit Passwort)

Kostenlos: Die Seite läuft auf **GitHub Pages**, die Daten liegen in **Google Firebase** (kostenloser Spark-Tarif).

---

## Einrichtung (einmalig, ca. 15 Minuten)

### 1. Firebase-Projekt anlegen
1. Auf <https://console.firebase.google.com> mit einem Google-Konto anmelden.
2. **Projekt hinzufügen** → Namen eingeben (z. B. `schuelerverkauf`) → Google Analytics kannst du ausschalten.

### 2. Datenbank (Firestore) aktivieren
1. Links **Build → Firestore Database** → **Datenbank erstellen**.
2. Standort `eur3 (europe-west)` wählen → **Im Produktionsmodus starten**.

### 3. Anmeldung aktivieren
1. Links **Build → Authentication** → **Jetzt starten**.
2. Unter **Anmeldemethode** zwei Anbieter aktivieren:
   - **Anonym** (damit Schüler ohne Anmeldung abstimmen können – sie merken davon nichts)
   - **E-Mail-Adresse/Passwort** (für dich als Admin)
3. Reiter **Nutzer** → **Nutzer hinzufügen** → deine E-Mail + ein sicheres Passwort. Das ist dein Admin-Login.

### 4. Web-App registrieren & Konfiguration einfügen
1. Zahnrad ⚙️ → **Projekteinstellungen** → unten **Meine Apps** → Web-Symbol `</>` → Namen eingeben → **App registrieren**.
2. Du siehst ein `firebaseConfig = { ... }`. Kopiere die Werte in die Datei **`js/firebase-config.js`**.
3. Trage dort bei `ADMIN_EMAIL` deine Admin-E-Mail ein.

### 5. Sicherheitsregeln einfügen
1. Öffne **`firestore.rules`** und ersetze `admin@example.com` durch **deine Admin-E-Mail**.
2. In Firebase: **Firestore Database → Regeln** → den kompletten Inhalt von `firestore.rules` hineinkopieren → **Veröffentlichen**.

> Die Regeln sorgen dafür, dass jedes Gerät nur **1 Stimme pro Runde** abgeben kann, nur du Produkte ändern darfst und nur du die Wünsche lesen kannst.

### 6. Auf GitHub Pages veröffentlichen
1. Änderungen aus Schritt 4 und 5 committen und auf den `main`-Branch pushen.
2. Im GitHub-Repo: **Settings → Pages** → *Source*: **Deploy from a branch** → Branch `main`, Ordner `/ (root)` → **Save**.
3. Nach 1–2 Minuten ist die Seite erreichbar unter
   - Schüler: `https://<dein-github-name>.github.io/schule-/`
   - Admin: `https://<dein-github-name>.github.io/schule-/admin.html`
4. In Firebase unter **Authentication → Einstellungen → Autorisierte Domains** die Domain `<dein-github-name>.github.io` hinzufügen.

Tipp: Mach aus dem Schüler-Link einen QR-Code und häng ihn in der Schule auf. 📱

---

## Bedienung (Admin)
1. `admin.html` öffnen und mit E-Mail + Passwort anmelden.
2. **Produkte hinzufügen** – sie erscheinen sofort bei den Schülern.
3. **Stimmen** siehst du live. **„Alle Stimmen auf 0 setzen"** startet eine neue Runde – alle Schüler dürfen dann wieder abstimmen.
4. **Wünsche** erscheinen live mit Datum. Einzeln mit ✕ oder alle auf einmal löschen.

## Hinweise
- „1 Stimme pro Gerät" gilt pro Browser. Ohne Anmeldung ist das nicht 100 % fälschungssicher (z. B. mit privatem Fenster könnte jemand nochmal abstimmen) – für den Schulalltag reicht es.
- Die Werte in `firebase-config.js` sind **keine Geheimnisse** – sie dürfen öffentlich sein. Die Sicherheit kommt aus den Regeln in `firestore.rules`.

## Lokal testen (optional, für Entwickler)
Mit dem Firebase-Emulator: `firebase emulators:start --only auth,firestore`, dann die Seiten mit `?emulator` aufrufen, z. B. `http://localhost:5000/index.html?emulator`.
