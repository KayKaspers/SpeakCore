# Architektur – Überblick

> Ergänzt [project-brain/ARCHITECTURE.md](../../project-brain/ARCHITECTURE.md).

SpeakCore ist strikt modular aufgebaut. Die zentrale Sicherheitsregel:

> Die **WebUI kontrolliert niemals direkt Docker, Host oder TeamSpeak.**
> Alle privilegierten Aktionen laufen über den **SpeakCore Agent**.

## Komponenten

- **SpeakCore WebUI** – Next.js/TypeScript/Tailwind; reine Präsentationsschicht, spricht nur die API.
- **SpeakCore Backend/API** – Auth, Setup-Wizard, Preflight & Capacity Advisor, Orchestrierung,
  Audit-Log. In 0.1 als Next.js Route Handler mit framework-unabhängiger Service-Schicht.
- **SpeakCore Agent** – separater, privilegierter Dienst für Docker-/Host-/Server-Aktionen.
- **Adapter Layer** – generische Servertyp-Abstraktion; 0.1 implementiert nur den TS3-Adapter.
- **TS3 Adapter** – spricht TeamSpeak 3 ServerQuery.
- **Datenbank** – SQLite (0.1) via Prisma.
- **Branding/Design-System** – zentrale Tokens.

## Datenfluss

```
0.1:    WebUI → SpeakCore API → Adapter Layer → TS3 Adapter → TeamSpeak 3 ServerQuery
                              ↘ SpeakCore Agent → Docker / Host
später: WebUI → SpeakCore API → Adapter Layer → TS6 Adapter → TeamSpeak 6 WebQuery/API
```

## Preflight & Capacity Advisor (Kernlogik, Step 005)

Eigenes Core-Modul, das schätzt, was eine Umgebung leisten kann (Ampel 🟢/🟡/🔴), welche Dienste
sinnvoll sind und welche Upgrades empfohlen werden. Die **reine Bewertungslogik** liegt in
`packages/shared/preflight/` (Typen in `packages/types`) – ohne Host-/DB-/Agent-Abhängigkeit.

- In Step 005 werden **keine echten Hostdaten** gemessen (Demo-/Dummy-Eingabe `ResourceSnapshot`).
- Richtwerte sind **konservative Empfehlungen, keine Garantie**; unbekannte Werte ergeben nie „grün".
- Echte Erhebung übernehmen spätere **Agent-Sonden**. Demo-UI: `/systemcheck`.

## Weiterführend

- [Agent](agent.md) · [Adapter Layer](adapter-layer.md) · [Sicherheit](security.md)
- [DECISIONS.md](../../project-brain/DECISIONS.md) für die zugrunde liegenden ADRs.
