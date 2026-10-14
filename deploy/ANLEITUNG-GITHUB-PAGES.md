# Anleitung: ad-studio.peripherique.de über GitHub Pages
So wie bei vorverkauf-nicosantos.peripherique.de: GitHub Pages liefert die Seite aus, Cloudflare macht DNS und HTTPS.

Dauer etwa 15 Minuten, danach wird jeder Push automatisch veröffentlicht.

---

## Schritt 1: Neue Dateien ins Repo
Diese Dateien aus dem Download-Paket in den Hauptordner des Repos legen. Sie gehören auf die oberste Ebene, nicht in einen Unterordner:

| Datei | Wofür |
|---|---|
| `CNAME` | Enthält `ad-studio.peripherique.de`, die Domain für GitHub Pages |
| `index.html` | Startseite (= Landingpage) |
| `404.html` | Fehlerseite, leitet `/app` ins Ad Studio weiter |
| `.nojekyll` | Leere Datei, damit GitHub alle Dateien unverändert ausliefert |
| `ad-studio-api.js` | Aktualisiert: Demo-Modus als Standard |
| `robots.txt` | Suchmaschinen sehen nur die Landingpage |

> Achtung: `.nojekyll` beginnt mit einem Punkt. Auf dem Mac ist die Datei im Finder unsichtbar, sichtbar machen mit **⌘ + ⇧ + .** (Punkt).

**Variante A: im Browser**
1. github.com/Lukas-PQ-World/peripherique-ad-studio öffnen
2. **Add file → Upload files**
3. Die Dateien hineinziehen, unten **Commit changes** klicken

**Variante B: im Terminal**
```
cd peripherique-ad-studio
# Dateien hineinkopieren, dann:
git add -A
git commit -m "GitHub Pages: CNAME, index, 404"
git push
```

---

## Schritt 2: Repo öffentlich machen oder GitHub Pro
GitHub Pages funktioniert bei **privaten** Repos nur mit einem kostenpflichtigen Konto (GitHub Pro, ca. 4 $ im Monat).

- **Öffentlich:** Repo → **Settings** → ganz unten **Danger Zone → Change visibility → Make public**.
  Das ist unbedenklich, weil Passwörter und Schlüssel nicht im Repo liegen (`.env` ist ausgeschlossen).
- **Privat bleiben:** github.com/settings/billing → GitHub Pro abschließen.

---

## Schritt 3: GitHub Pages einschalten
1. Repo → **Settings** → links **Pages**
2. **Source:** *Deploy from a branch*
3. **Branch:** `main`, Ordner `/ (root)` → **Save**
4. Unter **Custom domain** sollte `ad-studio.peripherique.de` automatisch stehen (aus der CNAME-Datei). Falls nicht: eintragen und **Save**.
5. Etwa 1 Minute warten. Oben erscheint *„Your site is live at …“*.

---

## Schritt 4: DNS bei Cloudflare
1. dash.cloudflare.com → Domain **peripherique.de** → **DNS → Records**
2. **Add record**:

| Feld | Wert |
|---|---|
| Type | `CNAME` |
| Name | `ad-studio` |
| Target | `lukas-pq-world.github.io` |
| Proxy status | **DNS only** (graue Wolke) |
| TTL | Auto |

3. **Save**

> Zuerst die graue Wolke, also nur DNS, ohne Proxy. Sonst kann GitHub kein HTTPS-Zertifikat ausstellen. Das Vorgehen ist dasselbe wie beim Eintrag `vorverkauf-nicosantos`.

---

## Schritt 5: HTTPS aktivieren
1. Zurück zu GitHub → Repo → **Settings → Pages**
2. Warten, bis bei *Custom domain* ein grüner Haken mit **„DNS check successful“** steht. Das dauert 1 bis 15 Minuten.
3. Haken bei **Enforce HTTPS** setzen. Falls er grau ist: noch kurz warten, das Zertifikat wird gerade ausgestellt.

**Optional danach:** In Cloudflare kannst du die Wolke auf **orange (Proxied)** stellen, für Caching und DDoS-Schutz. Dann unter **SSL/TLS → Overview** den Modus auf **Full** stellen, sonst gibt es eine Weiterleitungsschleife.

---

## Schritt 6: Testen
| Adresse | Erwartung |
|---|---|
| https://ad-studio.peripherique.de | Landingpage |
| https://ad-studio.peripherique.de/app | leitet ins Ad Studio |
| https://ad-studio.peripherique.de/Ad%20Studio.dc.html | Ad Studio direkt |

Anmelden mit `l.burczyk@pq-world.de` und deinem Passwort.

---

## Wichtig zu wissen
- **Demo-Modus:** Konten, Projekte und Uploads liegen nur im jeweiligen Browser. Wer den Link bekommt, legt sich dort ein eigenes Konto an und sieht nur seine eigenen Daten.
- **Landingpage ändern:** Nach jeder Änderung an `Ad Studio Landing.dc.html` die Datei auch als `index.html` speichern. Ich mache das bei Änderungen automatisch mit.
- **Backend später:** Für echte Konten, Zahlungen und das Posten auf Instagram, TikTok und YouTube kommt ein Server dazu, siehe Abschnitt „Phase 2“ in `deploy/README.md`. Danach in `ad-studio-api.js` die Zeile `API_BASE` setzen.

## Fehlerbehebung
| Problem | Lösung |
|---|---|
| „DNS check unsuccessful“ | CNAME auf `lukas-pq-world.github.io` prüfen, Wolke grau, 15 Minuten warten |
| Seite zeigt 404 | Pages-Branch `main` / root gesetzt? `index.html` im Hauptordner? |
| „Too many redirects“ | Cloudflare SSL/TLS auf **Full** stellen |
| Custom Domain verschwindet nach Push | Die `CNAME`-Datei fehlt im Repo |
| Ad Studio lädt nicht | Liegen `support.js`, `ad-studio-core.js` und `ad-studio-api.js` im Hauptordner? |
