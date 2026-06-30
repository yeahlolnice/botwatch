# BotWatch

A passive cybersecurity research platform for observing how malicious bots, automated scanners, LLM crawlers, and threat actors interact with web infrastructure in the wild.

No active scanning. No offensive techniques. Everything is collected passively by letting them come to us.

---

## What it does

BotWatch runs a live web server that looks like a normal application. In the background it silently fingerprints every request — logging IPs, user agents, payloads, headers, timing, and attack signatures — without ever interfering with the traffic.

The goal is to answer questions like:

- What are bots actually probing for right now?
- Which attack techniques are being used in the wild today?
- Can you identify LLM training crawlers from their request patterns?
- How quickly do known CVEs get picked up by automated scanners after disclosure?
- What do credential-stuffing payloads look like at scale?

---

## Honeypot endpoints

The server exposes a set of trap endpoints that return plausible-looking fake responses. Any request to these paths is logged and classified. Real users never visit them — only bots do.

| Path | Simulates | What gets captured |
|---|---|---|
| `/.env` | Leaked environment file | Full payload, whether credentials are harvested |
| `/.env.local` | Local dev config | Bot fingerprint, follow-up requests |
| `/.git/config` | Exposed git repo | Source recon attempts |
| `/wp-login.php` | WordPress login | Credential stuffing payloads, login attempts |
| `/wp-admin` | WordPress admin panel | Scanner behaviour, redirect following |
| `/wp-config.php` | WordPress database config | Automated config harvesting |
| `/phpinfo.php` | PHP info page | Stack fingerprinting |
| `/actuator/health` | Spring Boot actuator | Java app scanner detection |
| `/actuator/env` | Spring Boot env dump | Credential harvesting attempts |
| `/admin` | Generic admin panel | Brute force attempts, credential payloads |
| `/backup.sql` | Database backup download | Data exfiltration attempts |
| `/.aws/credentials` | AWS credential file | Cloud credential harvesting |
| `/.htpasswd` | Apache password file | Credential collection |
| `/.ssh` | SSH private key | Key harvesting attempts |
| `/robots.txt` | Standard robots file | Recon — often the first request a scanner makes |
| `/server-status` | Apache server status | Infrastructure fingerprinting |

---

## What gets tracked

Every request — honeypot or not — is logged with:

- IP address (via Cloudflare `CF-Connecting-IP`)
- User agent string
- Full request path, method, query string, and body
- All headers
- Response status and latency
- Bot/crawler classification (40+ known patterns)
- Payload analysis results — SQL injection, XSS, path traversal, command injection, and more (60+ signatures across 11 attack categories)
- Whether the request hit a honeypot trap, and which one

---

## Stack

- **Backend** — Node.js / Express 5, PostgreSQL
- **Frontend** — React + Vite (dashboard for browsing collected data)
- **Infrastructure** — Windows Server, Cloudflare Tunnel (no open ports)

---

## Scope

This is a personal research project. The data collected is used solely to study automated threat behaviour. No data is sold or shared. All credentials and keys visible in honeypot responses are intentionally fake.
