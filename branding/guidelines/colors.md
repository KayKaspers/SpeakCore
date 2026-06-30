# Farben

> Maßgeblich sind die Tokens in [../design-tokens/](../design-tokens/README.md). Diese Seite ist
> die lesbare Übersicht. **Keine Ad-hoc-Farben in der UI.**

## Palette (v0.2.0)

| Rolle | Token | Hex |
|-------|-------|-----|
| Background | `sc-background` | `#0B1220` |
| Surface | `sc-surface` | `#111827` |
| Surface raised | `sc-surface-raised` | `#1A2233` |
| Border | `sc-border` | `#1F2937` |
| Border strong | `sc-border-strong` | `#334155` |
| Primary | `sc-primary` | `#2563EB` |
| Primary hover | `sc-primary-hover` | `#1D4ED8` |
| Accent | `sc-accent` | `#06B6D4` |
| Info | `sc-info` | `#38BDF8` |
| Success 🟢 | `sc-success` | `#22C55E` |
| Warning 🟡 | `sc-warning` | `#F59E0B` |
| Error 🔴 | `sc-error` | `#EF4444` |
| Text primary | `sc-text-primary` | `#F8FAFC` |
| Text secondary | `sc-text-secondary` | `#94A3B8` |
| Text muted | `sc-text-muted` | `#64748B` |
| Focus ring | `sc-ring` | `#2563EB` |

## Einsatz

- **Primary** für Hauptaktionen/Fokus; **Accent** sparsam für Hervorhebungen/zweite Wortmarke.
- **Success/Warning/Error** nur semantisch (= Preflight-Ampel), nie dekorativ.
- Flächenhierarchie: `background` (App) < `surface` (Karten) < `surface-raised` (erhöht/Hover).
- Ränder dezent (`border`), nur wo nötig stärker (`border-strong`).

## Barrierearmut

- Ausreichende Kontraste sicherstellen (siehe [../ui/accessibility.md](../ui/accessibility.md)).
- `text-muted` nicht für wichtige/kleine Texte.
- Statusinfo nie allein über Farbe.
