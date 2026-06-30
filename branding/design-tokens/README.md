# SpeakCore Design Tokens

Quelle der Wahrheit für das visuelle System. **`tokens.json` ist maßgeblich**; `tokens.css`
und `tailwind.tokens.js` werden konsistent dazu gehalten.

## Dateien

| Datei | Zweck |
|-------|-------|
| `tokens.json` | Plattformneutrale Quelle (Farben, Typografie, Radius, Spacing, Shadow, Z-Index, Motion) |
| `tokens.css` | CSS Custom Properties (`--sc-*`) für rohes CSS |
| `tailwind.tokens.js` | Tailwind-Theme-Fragment (Utilities wie `bg-sc-surface`, `shadow-sc-md`) |

## Token-Gruppen (v0.2.0-draft)

- **Farben:** Flächen (`background`, `surface`, `surface-raised`, `border`, `border-strong`),
  Akzente (`primary`, `primary-hover`, `accent`, `info`), Status (`success`/`warning`/`error`),
  Text (`text-primary`/`-secondary`/`-muted`), `ring`.
- **Typografie:** `font-sans` (Inter), `font-mono`; Größen `display`…`caption`.
- **Radius:** `sm`…`xl`, `full`.
- **Spacing:** `1`…`8`.
- **Shadow:** `sm`/`md`/`lg` (dunkel abgestimmt).
- **Z-Index:** `base`, `dropdown`, `sticky`, `overlay`, `modal`, `toast`.
- **Motion:** Dauer `fast`/`base`/`slow`, Easing `standard`/`emphasized`.

## Regeln

- **Keine Ad-hoc-Farben in der UI** – nur Tokens verwenden.
- **Statusfarben = Preflight-Ampel** (`success`/`warning`/`error` ↔ 🟢/🟡/🔴). Konsistenz Pflicht.
- Bei Änderungen **immer alle drei Dateien** synchron halten (manuell, kein Build-Step in 0.1).

## Verwendung

```ts
// tailwind.config.ts
import speakcoreTokens from '../../branding/design-tokens/tailwind.tokens.js';
export default { theme: { extend: { ...speakcoreTokens } } };
```
