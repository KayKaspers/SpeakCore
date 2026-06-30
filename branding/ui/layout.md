# Layout – Richtlinien

> Enterprise-Dark, ruhig, dicht-aber-übersichtlich (Referenz: Proxmox/Grafana/TrueNAS).

## Grundgerüst

- App-Hintergrund `bg-sc-background`, Inhaltsflächen `bg-sc-surface`.
- **App-Shell:** linke **Sidebar** (Navigation) + Hauptbereich. Auf schmalen Viewports stapelt
  die Sidebar über dem Inhalt (`flex-col sm:flex-row`).
- **Zentrierte Flows** (Setup/Login): schmaler, vertikal zentrierter Container
  (`max-w-md`/`max-w-2xl`, `min-h-screen`, vertikal zentriert).

## Sidebar

- Breite `w-64` (Desktop), Rand `border-sc-border`.
- Kopf: Logo/Mark + Wortmarke. Navigationspunkte als Liste; aktiver Punkt
  `bg-sc-primary/10 text-sc-primary`, inaktive `text-sc-text-secondary`.
- Fuß: dezente Versions-/Step-Angabe (`text-sc-caption text-sc-text-muted`).

## Abstände & Dichte

- Seiten-Padding `px-6 py-6` (Desktop `sm:px-8`). Karten-Padding `p-6`.
- Vertikale Rhythmik über Spacing-Tokens (`sc-2`…`sc-8`); keine Ad-hoc-Pixelwerte.
- Maximale Lesebreite für Fließtext begrenzen (`max-w-xl`/`max-w-3xl`).

## Elevation

- Flach halten. Erhöhung über `bg-sc-surface-raised` und Schatten `shadow-sc-sm/md`,
  nicht über grelle Ränder. `shadow-sc-lg` nur für Overlays/Modals.

## Responsiveness

- Mobile-First-Grundtauglichkeit: alles ab ~360 px nutzbar, keine horizontalen Scrollbalken.
- Grids brechen auf eine Spalte um (`grid sm:grid-cols-2`).

## Z-Index

- Reihenfolge per Tokens: `dropdown < sticky < overlay < modal < toast`.
