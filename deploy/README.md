# Deployment: ad-studio.peripherique.de

## Phase 1: Cloudflare Pages (jetzt, Demo-Modus)
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → `Lukas-PQ-World/peripherique-ad-studio`
2. Build-Einstellungen: Framework **None**, Build command **leer**, Output directory **/**
3. Custom domain → `ad-studio.peripherique.de`. Liegt peripherique.de bei Cloudflare, wird der DNS-Eintrag (CNAME auf `<projekt>.pages.dev`) automatisch gesetzt.
4. Jeder Push auf `main` deployt automatisch.

URLs: `/` ist die Landingpage, `/app` das Ad Studio (über `_redirects`).

**Einschränkungen im Demo-Modus:**
- Konten, Projekte und Uploads liegen nur im Browser der jeweiligen Person.
- Teams funktionieren nur innerhalb eines Browsers.
- Zahlungen und Plattform-Verbindungen sind simuliert.
- Rendern und Posten sind nicht möglich.

## Phase 2: Backend dazuschalten (für echten Verkauf)
Das Backend (Node, SQLite, ffmpeg) läuft nicht auf Cloudflare Pages. Empfehlung: Hetzner CX22 mit Docker, angebunden über einen **Cloudflare Tunnel**. Dafür sind keine offenen Ports und keine eigene IP im DNS nötig.

```
# auf dem Server
apt install -y docker.io docker-compose-v2 git
git clone https://github.com/Lukas-PQ-World/peripherique-ad-studio.git && cd peripherique-ad-studio
cp backend/.env.example backend/.env    # Secrets eintragen
cd deploy && docker compose -f docker-compose.tunnel.yml up -d --build
```
- **Tunnel:** Im Cloudflare Dashboard unter Zero Trust → Networks → Tunnels anlegen und das Token als `TUNNEL_TOKEN` in `backend/.env` eintragen. Public Hostname: `api.ad-studio.peripherique.de` → `http://api:8787`
- **In `backend/.env` setzen:**
  - `PUBLIC_URL=https://api.ad-studio.peripherique.de`
  - `APP_URL=https://ad-studio.peripherique.de/app`
  - `CORS_ORIGIN=https://ad-studio.peripherique.de`
- **Frontend umstellen:** In `ad-studio-api.js` `API_BASE` auf `https://api.ad-studio.peripherique.de` setzen und pushen.
- **Plattformen und Stripe:**
  - OAuth-Redirects: `https://api.ad-studio.peripherique.de/oauth/{instagram|tiktok|youtube}/callback`
  - Stripe-Webhook: `https://api.ad-studio.peripherique.de/api/billing/webhook`

## Alternative: alles auf einem Server ohne Cloudflare Pages
`docker-compose.yml` mit Caddy (automatisches HTTPS). Dafür einen A-Eintrag `ad-studio` auf die Server-IP setzen und `docker compose up -d --build` starten.
