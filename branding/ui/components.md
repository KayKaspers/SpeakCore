# UI-Komponenten – Richtlinien

> Verbindliche Muster für konsistente UI. Farben/Abstände **immer** über Tokens
> ([../design-tokens/](../design-tokens/README.md)). Tailwind-Utilities: `sc-*`.

## Buttons

| Variante | Stil |
|----------|------|
| Primary | `bg-sc-primary` Text weiß, Hover `bg-sc-primary-hover`, `rounded-sc-md` |
| Secondary | `border border-sc-border-strong` Text `sc-text-secondary`, transparenter Grund |
| Ghost | nur Text `sc-text-secondary`, Hover `text-sc-text-primary` |
| Danger | `bg-sc-error` (nur für destruktive Aktionen, mit Bestätigung) |

- Padding: `px-4 py-2` (kompakt `px-3 py-2`), Schrift `text-sc-sm font-medium`.
- Disabled: `opacity-50`, kein Hover. Loading: Text durch „Bitte warten …" ersetzen, Button deaktiviert.
- Fokus: sichtbarer Ring (`ring-2 ring-sc-ring`), nie entfernen.

## Cards / Panels

- `bg-sc-surface border border-sc-border rounded-sc-lg p-6`; optional `shadow-sc-md`.
- Erhöhte/aktive Flächen: `bg-sc-surface-raised`.
- Überschrift `text-sc-h2 font-medium text-sc-text-primary`, Beschreibung `text-sc-sm text-sc-text-secondary`.

## Forms

- Label `text-sc-sm text-sc-text-secondary`, darüber dem Feld.
- Input: `bg-sc-background border border-sc-border rounded-sc-md px-3 py-2 text-sc-text-primary`,
  Fokus `border-sc-primary` + Ring.
- Fehlertext `text-sc-caption text-sc-error` direkt unter dem Feld; optionale Felder als „(optional)".
- Validierung server-seitig autoritativ; Client nur für UX.

## Alerts / Inline-Meldungen

- Erfolg: `bg-sc-success/15 text-sc-success` · Warnung: `bg-sc-warning/15 text-sc-warning`
  · Fehler: `bg-sc-error/15 text-sc-error` · Info: `bg-sc-info/15 text-sc-info`.
- Immer mit Text **und** Icon/Punkt – nie nur Farbe (siehe [status-system.md](status-system.md)).

## Badges / Status-Chips

- `rounded-sc-sm px-3 py-1 text-sc-sm font-medium` + farbiger Punkt (`h-2 w-2 rounded-full`).
- Statusfarben = Preflight-Ampel (grün/gelb/rot).

## Tables

- Kopf `text-sc-caption uppercase text-sc-text-muted`, Zeilen-Trenner `border-sc-border`.
- Zebra optional via `bg-sc-surface-raised/40`. Zahlen monospaced (`font-mono`).

## Wizard-Steps

- Schrittanzeige „Schritt {n} von {m}" als `text-sc-caption text-sc-text-secondary`.
- Auswahlkarten: Rahmen `border-sc-border`, aktiv `border-sc-primary bg-sc-primary/10`.
- Navigation: „Zurück" (Secondary) links, „Weiter/Abschließen" (Primary) rechts.

## Empty States

- Zentriert: kurzer Titel `text-sc-h2`, erklärender Satz `text-sc-text-secondary`, optional eine
  primäre Aktion. Kein Spinner für „leer" (≠ „lädt").

## Error States

- Verständliche, nicht-technische Meldung; kein Stacktrace/kein Secret-Leak.
- Wiederholbare Aktion anbieten („Erneut versuchen"). Globale Fehler als Alert oben im Inhalt.
