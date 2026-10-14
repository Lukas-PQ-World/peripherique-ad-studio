# Deployment: ad-studio.peripherique.de

## 1. DNS
Beim DNS-Anbieter von peripherique.de:
| Typ | Name | Wert |
|---|---|---|
| A | ad-studio | öffentliche IPv4 des Servers |
| AAAA | ad-studio | IPv6 des Servers (optional) |

## 2. Server (z. B. Hetzner CX22, Ubuntu 24.04)
```
apt install -y docker.io docker-compose-v2 git
git clone https://github.com/<user>/ad-studio.git && cd ad-studio
cp backend/.env.example backend/.env   # Secrets eintragen, SUPERADMIN_PASSWORD setzen
cd deploy && docker compose up -d --build
```
Caddy holt das HTTPS-Zertifikat automatisch, sobald der DNS-Eintrag auf den Server zeigt. Ports 80 und 443 müssen offen sein.

## 3. URLs
- https://ad-studio.peripherique.de: Landingpage
- https://ad-studio.peripherique.de/app: Ad Studio, nutzt automatisch den Server
- OAuth-Redirects: https://ad-studio.peripherique.de/oauth/{instagram|tiktok|youtube}/callback
- Stripe-Webhook: https://ad-studio.peripherique.de/api/billing/webhook

## 4. Updates
```
git pull && cd deploy && docker compose up -d --build
```
Die Daten (SQLite, Uploads, Renders) liegen im Volume `api-data`. Für das Backup dieses Volume täglich sichern.
