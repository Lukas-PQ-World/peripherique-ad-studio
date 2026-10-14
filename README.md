# Peripherique Ad Studio

SaaS zum Erstellen und Veröffentlichen von Event-Ads (Konzert, Festival, Club, Theater, Konferenz …) für Instagram, TikTok, YouTube und Display.

**Live:** https://ad-studio.peripherique.de (DNS noch setzen, siehe `deploy/README.md`)

## Inhalt
| Pfad | Zweck |
|---|---|
| `Ad Studio Landing.dc.html` | Landingpage mit Preisen und FAQ |
| `Ad Studio.dc.html` | App: Projekte, Editor, Mediathek, Team, Abo, Plattform-Admin |
| `ad-studio-core.js` | Formate, Templates, Schnitt-Engine, Audio |
| `ad-studio-api.js` | API-Client: Demo-Modus (Browser) oder Server, Pläne und Rechte |
| `support.js` | Runtime für die .dc.html-Dateien |
| `backend/` | Node/Express/SQLite: Auth, Teams, Stripe, OAuth, Rendering, Publishing, Analytics |
| `deploy/` | Docker Compose und Caddy (HTTPS) für ad-studio.peripherique.de |
| `assets/`, `Nico Santos *.dc.html` | Beispielprojekt (Demo) |

## Lokal starten
- **Frontend:** Ordner mit einem statischen Server ausliefern (z. B. `npx serve .`) und `Ad Studio.dc.html` öffnen.
- **Backend:** siehe `backend/README.md`.

## Zugang
Die Registrierung läuft nur auf Einladung (`REGISTRATION=invite`). Neue Kunden lädt der Plattform-Admin unter Einstellungen → Plattform-Admin → Kunden einladen ein.
