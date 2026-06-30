# Accessibility – Mindestanforderungen

> Verbindlich für alle SpeakCore-UI. Ziel: WCAG 2.1 AA als Orientierung.

## Kontrast

- Fließtext: **≥ 4.5:1**, große Überschriften: **≥ 3:1**.
- `text-primary` (#F8FAFC) auf `background`/`surface` erfüllt dies deutlich.
- `text-secondary` (#94A3B8) nur für sekundäre Inhalte; `text-muted` (#64748B) nicht für wichtige
  oder kleine Texte (Kontrast grenzwertig) – sparsam einsetzen.

## Fokus

- **Sichtbarer Fokus-Zustand** auf allen interaktiven Elementen (`ring-2 ring-sc-ring` o. ä.).
- Fokus **nie** entfernen (`outline:none` nur mit gleichwertigem Ersatz).
- Logische Fokus-Reihenfolge; Modals fangen Fokus ein und geben ihn zurück.

## Tastatur

- Alles per Tastatur bedienbar (Tab/Shift-Tab, Enter/Space, Esc schließt Overlays).
- Keine reinen Hover-/Maus-Interaktionen ohne Tastatur-Äquivalent.

## Nicht nur Farbe

- Status/Ampel **immer** mit Text und/oder Icon (siehe [status-system.md](status-system.md)).
- Fehler nicht allein durch rote Umrandung – zusätzlich Fehlermeldung als Text.

## Semantik & Screenreader

- Sinnvolle Landmarks (`main`, `nav`, `header`), Labels (`label for`/`aria-label`).
- Icons ohne Textbedeutung: `aria-hidden`. Dekorative SVGs nicht vorlesen.
- Sprache am `<html lang>` setzen (DE/EN über next-intl).

## Fehlermeldungen

- Verständlich, lösungsorientiert, ohne technische Interna/Secrets.
- Mit dem betroffenen Feld verknüpft; bei Bedarf `aria-describedby`.

## Responsiveness

- Nutzbar ab ~360 px Breite, ohne horizontales Scrollen.
- Touch-Ziele ausreichend groß (~40 px). Zoom bis 200 % darf das Layout nicht zerstören.
