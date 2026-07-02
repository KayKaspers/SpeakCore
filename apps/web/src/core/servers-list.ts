/**
 * Reine Helfer für die Serverlisten-Ansicht (NDF Step 028) – unit-testbar, ohne DB/Docker/Agent.
 *
 * Trennt **aktive** (nicht archivierte) von **archivierten** Servern. Rein lesend; keine Schreibaktion,
 * keine Lifecycle-Aktion, keine Secrets.
 */
export type ServerListView = 'active' | 'archived';

/** Normalisiert einen (untrusted) Query-Parameter auf eine gültige Ansicht (Default: `active`). */
export function normalizeServerListView(value: string | undefined | null): ServerListView {
  return value === 'archived' ? 'archived' : 'active';
}

/** Prisma-`where`-Filter für die Ansicht: aktiv = `archivedAt: null`, archiviert = `archivedAt != null`. */
export function serverListWhere(view: ServerListView): { archivedAt: null } | { archivedAt: { not: null } } {
  return view === 'archived' ? { archivedAt: { not: null } } : { archivedAt: null };
}
