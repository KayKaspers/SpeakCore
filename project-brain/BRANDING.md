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

## 6. Assets

- Logos: [`branding/logos/`](../branding/logos/) (noch Platzhalter)
- Icons: [`branding/icons/`](../branding/icons/) (noch Platzhalter)
- Design-Tokens (Quelle der Wahrheit): [`branding/design-tokens/`](../branding/design-tokens/)
  - `tokens.json` – plattformneutral
  - `tokens.css` – CSS Custom Properties
  - `tailwind.tokens.js` – Tailwind-Theme-Fragment

## 7. Status

Es liegt noch **kein finales Asset-Set** vor. Diese Datei und die Tokens definieren die
verbindliche Grundlage; finale Logos/Icons folgen in einem späteren NDF-Schritt. Falls ein
BrandKit-Ordner bereitgestellt wird, ist dieser als Quelle zu analysieren und einzuarbeiten.
