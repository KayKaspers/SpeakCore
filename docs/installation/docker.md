# Installation: Docker (empfohlen)

> SpeakCore ist **Docker-first**. Dies ist der empfohlene und am besten unterstützte Weg.

## Voraussetzungen

- 64-bit Linux-Host
- Docker Engine + Docker Compose Plugin
- Ausreichende Ressourcen (der Preflight & Capacity Advisor prüft dies automatisch)

## Schnellstart (geplant für 0.1)

```bash
# 1. Repository / Release beziehen
git clone <repo-url> speakcore && cd speakcore

# 2. Beispielkonfiguration kopieren (Secrets werden generiert, keine Default-Passwörter)
cp .env.example .env

# 3. Suite starten
docker compose up -d

# 4. WebUI öffnen und Setup-Wizard durchlaufen
#    → Admin-Account anlegen, Sprache wählen, Preflight-Bewertung ansehen
```

## Optionales Setup-Script (für Einsteiger)

Für Einsteiger ist ein optionales Script vorgesehen, das Voraussetzungen prüft (Docker, Compose,
Ressourcen) und den Wizard startet. Es ersetzt **nicht** den Preflight & Capacity Advisor,
sondern führt zu ihm hin.

## Nach der Installation

- Setup-Wizard: Admin anlegen, Simple/Expert Mode wählen, Sprache (DE/EN).
- Preflight & Capacity Advisor bewertet die Umgebung (🟢/🟡/🔴).
- TS3-Server **verbinden** (bestehend) oder **installieren** (neu, via Agent).

## Sicherheitshinweise

- WebUI nur über TLS exponieren; Agent-Port niemals öffentlich.
- `.env` enthält Secrets → niemals committen (siehe `.gitignore`).

> Stand NDF Step 001: Befehle illustrieren den geplanten 0.1-Ablauf; es existiert noch kein
> lauffähiges Image.
