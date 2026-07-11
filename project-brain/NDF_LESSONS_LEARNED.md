# NDF_LESSONS_LEARNED.md – SpeakCore

> NDF Project Brain · Stand: 2026-07-11 · **Interne, bestätigte SpeakCore-Erfahrungen** mit dem
> Nova Development Framework (NDF). Kompakte SSOT der tatsächlich gewonnenen Learnings.
>
> **Abgrenzung:** Diese Datei = **interne, bestätigte** SpeakCore-Erfahrungen.
> [../docs/ndf/FEEDBACK_TO_NDF.md](../docs/ndf/FEEDBACK_TO_NDF.md) = **Kandidaten** für eine mögliche
> Rückführung ins NDF (Beobachtung → Kandidat → akzeptiert/verworfen). Ausführliche Kandidaten-Felder
> dort, nicht hier doppeln.

## Bestätigte Learnings

1. **Kleine, prüfbare NDF-Schritte.** Genau ein begrenztes Work Package pro Ausführung hält Scope,
   Review und Rückmeldung überschaubar (Steps 015–042).
2. **Blueprint vor gefährlichen Funktionen.** Erst reine, getestete Guard-/Planungslogik
   (`executable: false`), dann minimale Ausführung — bewährt bei Deprovisioning (024),
   Backup (030), Download (036), Delete/Rotation (039).
3. **Security-, ADR- und Risiko-Dokumentation** zu jeder relevanten Änderung
   ([SECURITY.md](SECURITY.md), [RISKS.md](RISKS.md), [DECISIONS.md](DECISIONS.md)).
4. **Guard- und Planungslogik vor Write-Aktionen** in reinen, unit-testbaren Modulen
   (`packages/shared`), getrennt von der Ausführung im Agent/Web.
5. **Owner-, Bestätigungs- und Audit-Patterns** bei sensiblen/destruktiven Aktionen: OWNER-only,
   getippte Bestätigungen (`DELETE VOLUME`, `CREATE BACKUP`, `DOWNLOAD BACKUP`, `DELETE BACKUP`),
   Audit ohne Secrets/Host-Pfade/Dateiinhalte/Dateinamen.
6. **read-only vor destructive.** Erst sichtbar/verifizierbar machen, dann verändern — der
   Backup-Lebenszyklus (032–041) folgt konsequent dieser Reihenfolge.
7. **Push- und Release-Freigabe durch den Human Maintainer.** Claude committet höchstens lokal und
   pusht/merged/taggt/released nie autonom.
8. **Strukturierte, kompakte Claude-Rückmeldung** am Ende jedes Steps erleichtert Review und die
   Planung des nächsten Steps.
9. **Context Packs und Compact Context Summary** senken Token-Aufwand und Übergabereibung
   ([CONTEXT_PACK_SPEAKCORE_CURRENT.md](CONTEXT_PACK_SPEAKCORE_CURRENT.md)).
10. **Skills-first seit NDF v1.0.0.** Vor jedem WP werden die verfügbaren Skills geprüft und nur die
    erforderlichen genutzt; Skills sind docs-only Governance-Hilfen, keine Entscheidungsinstanz
    ([../CLAUDE.md](../CLAUDE.md), [../docs/ndf/SKILL_INVENTORY.md](../docs/ndf/SKILL_INVENTORY.md)).

## Neu aus der Restore-Analyse (Step 043)

11. **Archiv-Inhalt ist eine eigene Trust Boundary.** Ein von SpeakCore erzeugtes Backup ist beim
    Zurückspielen genauso misstrauisch zu behandeln wie Fremd-Input: Traversal/Symlink/Hardlink/
    Sonderdateien/Archive-Bomb müssen vor jeder Extraktion geprüft werden — Extraktion nie direkt
    ins Live-Ziel (Staging + Containment-Prüfung).
12. **Vorhandene Integrität ≠ Wiederherstellbarkeit.** SHA-256 über die tar.gz belegt Integrität,
    aber ein Backup ist erst nach einem **verifizierten Restore-Prozess** eine belastbare
    Recovery-Grundlage. Das gehört explizit ins Risiko (R-06).
13. **Destructive/zustandsersetzende Aktionen brauchen ein State-Modell + Locks + Pflicht-Rollback-
    Quelle.** Pre-Restore-Sicherungspunkt, Restore-Lock und ein Zustandsautomat mit sicheren
    Übergängen (inkl. `ROLLBACK_FAILED`/`CLEANUP_REQUIRED`) sind Teil der Sicherheit, nicht optional.
14. **Read-only Plan mit Fingerprint-Bindung vor der Ausführung** schließt das TOCTOU-Fenster
    (Backup-/Instanz-Austausch zwischen Plan und Apply) und ermöglicht Replay-Schutz über eine
    verbrauchbare, ablaufende Plan-/Operation-ID.
15. **Bestehende flache Audit-/Statusstrukturen stoßen an Grenzen.** Der Restore braucht deutlich
    mehr strukturierte Audit-Felder als `action/actor/target/result` — bewusst als ADR-/Migration-
    Kandidat markieren statt still zu erweitern.

## Verwendung

- Neue **bestätigte** Learnings hier kompakt ergänzen (eine Zeile pro Punkt, mit Step-Bezug).
- Noch offene/experimentelle Beobachtungen und NDF-Rückführungs-Kandidaten gehören in
  [../docs/ndf/FEEDBACK_TO_NDF.md](../docs/ndf/FEEDBACK_TO_NDF.md).
