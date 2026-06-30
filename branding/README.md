# SpeakCore – Branding & Design-System

> Corporate-Design-Konzept: [project-brain/BRANDING.md](../project-brain/BRANDING.md).
> Dieses Verzeichnis enthält die **Design-Tokens** (Quelle der Wahrheit) und Asset-Ordner.

## Inhalt

```
branding/
├── design-tokens/
│   ├── tokens.json          # plattformneutral (Quelle der Wahrheit)
│   ├── tokens.css           # CSS Custom Properties (--sc-*)
│   └── tailwind.tokens.js   # Tailwind-Theme-Fragment
├── logos/                   # Logos (noch Platzhalter)
├── icons/                   # Icons (noch Platzhalter)
└── README.md
```

## Stilrichtung

**Enterprise Dark** · Infrastruktur-/Server-Ästhetik · modern, vertrauenswürdig, zeitlos.
Referenzniveau: Proxmox, Grafana, TrueNAS.

## Tokens verwenden

- **CSS:** `tokens.css` importieren und Variablen wie `var(--sc-color-primary)` nutzen.
- **Tailwind:** `tailwind.tokens.js` in die Theme-Extension einbinden (siehe Datei-Header).
- **Andere Plattformen:** `tokens.json` als neutrale Quelle parsen.

## Statusfarben = Ampelsystem

`success` / `warning` / `error` entsprechen direkt dem Ampelsystem (🟢/🟡/🔴) des
Preflight & Capacity Advisors. Visuelle und funktionale Semantik bleiben deckungsgleich.

## Status

Tokens sind **vorläufig** (`0.1.0-draft`). Finale Logos/Icons folgen in einem späteren
NDF-Schritt. Wird ein BrandKit bereitgestellt, ist es hier zu analysieren und einzuarbeiten.
