# BRANDING.md – Corporate Design SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30
> Maßgebliche Tokens liegen in [`branding/design-tokens/`](../branding/design-tokens/).

## 1. Stilrichtung

**Enterprise Dark** · Infrastruktur-/Server-Ästhetik · modern, aber nicht verspielt ·
vertrauenswürdig · zeitlos. Referenz-Qualitätsniveau: Proxmox, Grafana, TrueNAS.

## 2. Markenwerte (visuell übersetzt)

| Wert | Visuelle Umsetzung |
|------|--------------------|
| Vertrauen | ruhige Dark-Surface, klare Hierarchie, keine Effekthascherei |
| Kontrolle | dichte, aber übersichtliche Dashboards, klare Statusfarben |
| Stabilität | konsistente Tokens, zurückhaltende Animation |
| Modularität | Karten-/Panel-Layouts, klare Komponentengrenzen |
| Open Source | offene Tokens, dokumentierte Design-Entscheidungen |
| Sicherheit | eindeutige Ampel-/Warnsemantik (Success/Warning/Error) |
| Community | freundliche, klare Sprache; gute Defaults |

## 3. Farbpalette (vorläufig)

| Token | Hex | Verwendung |
|-------|-----|------------|
| Background | `#0B1220` | App-Hintergrund |
| Surface | `#111827` | Karten, Panels |
| Primary Blue | `#2563EB` | primäre Aktionen, Fokus |
| Accent Cyan | `#06B6D4` | Akzente, Hervorhebungen |
| Success | `#22C55E` | 🟢 Preflight grün, OK-Zustände |
| Warning | `#F59E0B` | 🟡 Einschränkungen, Hinweise |
| Error | `#EF4444` | 🔴 nicht empfohlen, Fehler |
| Text Primary | `#F8FAFC` | Haupttext |
| Text Secondary | `#94A3B8` | sekundärer Text, Labels |

Success/Warning/Error sind zugleich die **Ampelfarben** des Preflight & Capacity Advisors –
visuelle Konsistenz mit der Kernlogik ([MVP.md](MVP.md) §3).

## 4. Typografie

- Primärschrift: **Inter** (oder vergleichbare moderne Sans-Serif).
- Klare Skala, gut lesbar in dichten Dashboards. Details:
  [docs/branding/typography.md](../docs/branding/typography.md).

## 5. UI-Prinzipien (Kurz)

- Dark-first, hoher Kontrast für Text Primary auf Background/Surface.
- Statusfarben nur semantisch (nie dekorativ) einsetzen.
- Simple Mode reduziert sichtbare Komplexität; Expert Mode zeigt Details/Overrides.
- Barrierearmut: ausreichende Kontraste, Fokuszustände, keine reine Farbcodierung
  (immer zusätzlich Text/Icon zur Ampel).
- Vollständige Prinzipien: [docs/branding/ui-principles.md](../docs/branding/ui-principles.md).

## 6. Brand Kit (ab Step 005B)

`branding/` ist ein vollständiges **Brand Kit**:

- **Design-Tokens** (Quelle der Wahrheit, `v0.2.0-draft`): [`branding/design-tokens/`](../branding/design-tokens/)
  – `tokens.json` (maßgeblich) + `tokens.css` + `tailwind.tokens.js` (konsistent). Gruppen:
  Farben, Status, Text, Border, Radius, Spacing, Shadow, Z-Index, Motion.
- **Logos:** [`branding/logos/`](../branding/logos/) – Voll-Logo + Mark, je dark/light (SVG,
  Hexagon + „S" + Netzwerk-Knoten). Wortmarke zweifarbig „**Speak**" + „**Core**".
- **Icons:** [`branding/icons/`](../branding/icons/) – `favicon.svg`, `app-icon.svg`.
- **Social:** [`branding/social/`](../branding/social/) – `github-social.svg`, `opengraph.svg`.
- **UI-Richtlinien:** [`branding/ui/`](../branding/ui/) – components, layout, status-system, accessibility.
- **Guidelines:** [`branding/guidelines/`](../branding/guidelines/) – brand-guidelines, logo-usage,
  colors, typography, voice-and-tone.

Die Mark ist in der WebUI als `BrandMark`-Komponente eingebunden (Setup/Login/Dashboard/Systemcheck)
plus `app/icon.svg` als Favicon.

## 7. Status

- **Verbindlich:** Stilrichtung, Markenwerte, Design-Tokens, UI-/Accessibility-Regeln,
  Logo-Idee (Hexagon/„S"/Knoten), Farbwelt.
- **Platzhalter (hochwertig, nicht final):** konkrete Logo-/Icon-/Social-SVGs. Keine Binärdateien,
  keine eingebetteten Fonts (System-Fallback `Inter`). Finale Verfeinerung kann später erfolgen.
