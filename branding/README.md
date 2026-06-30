# SpeakCore – Brand Kit & Design-System

> Corporate-Design-Konzept: [project-brain/BRANDING.md](../project-brain/BRANDING.md).
> Dieses Verzeichnis ist das **Brand Kit**: Design-Tokens (Quelle der Wahrheit), Assets und
> Richtlinien.

## Struktur

```
branding/
├── design-tokens/      Tokens (Quelle der Wahrheit) + README
│   ├── tokens.json     plattformneutral (maßgeblich)
│   ├── tokens.css      CSS Custom Properties (--sc-*)
│   └── tailwind.tokens.js  Tailwind-Theme-Fragment
├── logos/              Logo- & Mark-Varianten (SVG, dark/light) + README
├── icons/              favicon.svg, app-icon.svg + README
├── social/             github-social.svg, opengraph.svg + README
├── ui/                 components · layout · status-system · accessibility
└── guidelines/         brand-guidelines · logo-usage · colors · typography · voice-and-tone
```

## Stilrichtung

**Enterprise Dark** · Infrastruktur-/Server-Ästhetik · modern, vertrauenswürdig, zeitlos.
Referenzniveau: Proxmox, Grafana, TrueNAS. Kein Gaming-/Cyberpunk-Stil.

## Tokens verwenden

- **CSS:** `design-tokens/tokens.css` importieren, Variablen wie `var(--sc-color-primary)`.
- **Tailwind:** `design-tokens/tailwind.tokens.js` in die Theme-Extension einbinden.
- **Andere Plattformen:** `design-tokens/tokens.json` als neutrale Quelle parsen.

## Statusfarben = Ampelsystem

`success` / `warning` / `error` entsprechen direkt dem Ampelsystem (🟢/🟡/🔴) des
Preflight & Capacity Advisors. Visuelle und funktionale Semantik bleiben deckungsgleich
(siehe [ui/status-system.md](ui/status-system.md)).

## Status

- **Verbindlich:** Stilrichtung, Markenwerte, Design-Tokens (`v0.2.0-draft`), UI-/Accessibility-
  Regeln, Logo-Idee (Hexagon/„S"/Knoten), Farbwelt.
- **Platzhalter (hochwertig, nicht final):** konkrete Logo-/Icon-/Social-SVGs. Keine Binärdateien,
  keine eingebetteten Fonts.
