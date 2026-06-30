# Status- & Ampelsystem

> Die Statusfarben sind **identisch** mit dem Preflight & Capacity Advisor (🟢/🟡/🔴) und
> bilden ein projektweit einheitliches Vokabular.

## Ampel

| Status | Token | Bedeutung | Beispiel |
|--------|-------|-----------|----------|
| 🟢 Grün | `sc-success` | geeignet / OK / erfolgreich | „Geeignet", „Bereit" |
| 🟡 Gelb | `sc-warning` | möglich mit Einschränkungen / Achtung | „Möglich mit Einschränkungen", „Setup ausstehend" |
| 🔴 Rot | `sc-error` | nicht empfohlen / Fehler | „Nicht empfohlen", Validierungsfehler |
| ℹ️ Info | `sc-info` | neutrale Information | Hinweise |

## Regeln

1. **Nie nur Farbe** – Status immer zusätzlich durch **Text und/oder Icon/Punkt** kommunizieren
   (Barrierefreiheit, Farbsehschwäche).
2. Farben **ausschließlich semantisch** einsetzen – nicht dekorativ.
3. Hintergrund-Variante für Chips/Alerts: `bg-sc-<status>/15` mit `text-sc-<status>`.
4. Punkt/Indikator: `h-2 w-2 rounded-full bg-sc-<status>`.

## Severity-Reihenfolge

Für Gesamtbewertungen gilt **rot > gelb > grün** (schlechtester Einzelwert bestimmt das Ergebnis,
vgl. `calculateOverallPreflightStatus`).

## Beispiel (Markup-Skizze)

```html
<span class="inline-flex items-center gap-2 rounded-sc-sm bg-sc-warning/15 px-3 py-1 text-sc-sm font-medium text-sc-warning">
  <span class="inline-block h-2 w-2 rounded-full bg-sc-warning"></span>
  Möglich mit Einschränkungen
</span>
```
