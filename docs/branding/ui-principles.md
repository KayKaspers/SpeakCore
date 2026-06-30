# Branding: UI-Prinzipien

> Maßgeblich: [BRANDING.md](../../project-brain/BRANDING.md). Konkrete Komponenten-/Layout-/
> Accessibility-Regeln im Brand Kit: [`branding/ui/`](../../branding/ui/components.md).

## Grundhaltung

Enterprise Dark, Infrastruktur-/Server-Ästhetik: modern, aber nicht verspielt; vertrauenswürdig
und zeitlos. Qualitätsanspruch im Umfeld von Proxmox, Grafana, TrueNAS.

## Prinzipien

1. **Vertrauen vor Effekt** – ruhige Oberflächen, klare Hierarchie, zurückhaltende Animation.
2. **Klarheit der Statuskommunikation** – Ampel-/Statusfarben nur semantisch, immer mit Text/Icon.
3. **Simple vs. Expert** – Simple Mode reduziert sichtbare Komplexität und blendet Risiko-Optionen
   aus; Expert Mode zeigt Details, Overrides und Warnbestätigungen.
4. **Sicherheit sichtbar machen** – riskante Konfiguration wird klar markiert; destruktive Aktionen
   (z. B. Restore) erfordern bewusste Bestätigung.
5. **Panel-/Karten-Layout** – modulare, klar abgegrenzte Komponenten passend zur modularen Architektur.
6. **Barrierearmut** – ausreichende Kontraste, sichtbare Fokuszustände, keine reine Farbcodierung.
7. **Konsistenz über Tokens** – Farben, Abstände und Typografie kommen aus den Design-Tokens,
   nicht aus Einzelfall-Werten.

## Bezug zur Kernlogik

Die Statusfarben Success/Warning/Error entsprechen direkt dem Ampelsystem des Preflight &
Capacity Advisors (🟢/🟡/🔴). Visuelle und funktionale Semantik bleiben deckungsgleich.
