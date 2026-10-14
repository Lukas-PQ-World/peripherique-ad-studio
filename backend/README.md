# Ad Studio – Backend

Node 20 + Express + SQLite. Enthält Konten mit Organisationen, Projekt-Speicher mit Änderungshistorie, Medien-Upload, OAuth für Instagram/TikTok/YouTube, ein Rendering mit ffmpeg, Publishing und Analytics mit eigenem Klick-Tracking.

## Start
```
cd backend
cp .env.example .env      # Werte eintragen
npm install
node --env-file=.env server.js
```
Voraussetzung: `ffmpeg` im PATH (mit libx264, libvpx, prores_ks, drawtext/fontconfig).

Im Ad Studio unter **Konto → Backend** den Server-Modus wählen und `PUBLIC_URL` eintragen.

## Plattformen einrichten
| Plattform | App anlegen | Redirect-URL | Hinweise |
|---|---|---|---|
| Instagram | developers.facebook.com (Business-App) | `PUBLIC_URL/oauth/instagram/callback` | Instagram-Business-Konto mit Facebook-Seite. App-Review für `instagram_content_publish` und `instagram_manage_insights`. Die Video-URL muss öffentlich erreichbar sein. |
| TikTok | developers.tiktok.com | `PUBLIC_URL/oauth/tiktok/callback` | Content Posting API freischalten. Die Domain von `PUBLIC_URL` in TikTok verifizieren (PULL_FROM_URL). Bis zum Audit sind Posts nur privat sichtbar. |
| YouTube | console.cloud.google.com (YouTube Data API v3) | `PUBLIC_URL/oauth/youtube/callback` | OAuth-Consent-Screen verifizieren lassen. Ohne Verifizierung landen Uploads auf „privat“. Upload-Kontingent: 1.600 Units pro Video. |

## Analytics
- **Views, Likes, Shares, Kommentare:** kommen von der jeweiligen Plattform-API, mit 15 Minuten Cache.
- **Klicks:** Organische Posts liefern keine Link-Klicks. Deshalb hängt das Backend einen Tracking-Link `PUBLIC_URL/l/<id>` an die Caption. Er zählt jeden Klick und leitet auf die Ticket-URL weiter.
- **CTR:** Klicks geteilt durch Views.

## SaaS: Abos, Team, Admin
- **Pläne:** Free, Starter, Pro und Agency. Dazu kommen die Add-ons KI-Paket, Team-Platz und White-Label. Preise und Grenzen stehen in `plans.js` und `ad-studio-api.js` und müssen in beiden Dateien gleich sein.
- **Testphase:** Neue Organisationen bekommen 14 Tage Pro. Danach gilt Free, solange nichts gebucht ist.
- **Durchsetzung auf dem Server:** Der Server prüft Projekt-Limit, Team-Plätze, KI-Kontingent, Exportformate, Direkt-Posting und Wasserzeichen.
- **Stripe:** Je Plan und Zyklus einen Preis anlegen und die ID in die `.env` eintragen. Den Webhook auf `PUBLIC_URL/api/billing/webhook` setzen, mit diesen Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` und `customer.subscription.deleted`. Steuern laufen über Stripe Tax (`automatic_tax`).
- **Rollen:**

| Rolle | Darf |
|---|---|
| Inhaber | alles, auch Abrechnung |
| Admin | Team, Plattformen, Veröffentlichen |
| Editor | Projekte und Ads bearbeiten |
| Reviewer | Ads freigeben |
| Nur lesen | ansehen |

- **Plattform-Admin:** Wird aus `SUPERADMIN_*` angelegt. Er sieht alle Organisationen, MRR und ARR und kann Pläne manuell setzen.

## Noch offen für den Verkauf
- Rechtstexte (AGB, AVV, Datenschutz), Impressum, Cookie-Hinweis.
- Einladungen per E-Mail versenden. Aktuell wird ein Einladungslink kopiert.
- Mediendateien auf S3/R2 statt lokaler Festplatte. Render-Queue als eigener Worker, z. B. mit BullMQ.
- Passwort-Reset per E-Mail, 2FA.
- Soundeffekte aus dem Editor werden im Browser synthetisiert und noch nicht mitgerendert.
