# Typografie

> Tokens: [../design-tokens/](../design-tokens/README.md).

## Schrift

- Primär: **Inter** (System-Fallback `system-ui, -apple-system, Segoe UI, Roboto, …`).
  Keine eingebetteten Fontdateien in 0.1 – Fallback-Stack genügt.
- Monospace (Logs, Ports, IDs, Tokens-Anzeige): `ui-monospace, SFMono-Regular, Menlo, Consolas`.

## Skala

| Rolle | Token | Größe |
|-------|-------|-------|
| Display | `sc-display` | 2.25rem |
| H1 | `sc-h1` | 1.5rem |
| H2 | `sc-h2` | 1.25rem |
| Body | `sc-body` | 1rem |
| Small | `sc-sm` | 0.875rem |
| Caption | `sc-caption` | 0.75rem |

## Regeln

- Klare Hierarchie: eine `h1` pro Seite, darunter `h2` für Abschnitte.
- Gewichte: 700 für Titel/Buttons, 500 für Hervorhebungen, 400 Fließtext.
- Fließtextbreite begrenzen (Lesbarkeit). Zeilenhöhe großzügig.
- Technische Werte (Ports/IDs/Logs) monospaced für bessere Scanbarkeit.
- Keine reinen Großbuchstaben für lange Texte; Caps nur für kurze Labels mit `letter-spacing`.
