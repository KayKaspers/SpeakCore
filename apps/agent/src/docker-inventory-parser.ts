/**
 * Reiner Parser für die read-only Docker-Inventar-Ausgabe (NDF Step 011).
 *
 * Wandelt `--format`-Zeilen in **managed-only** DTOs um. Nicht-verwaltete Ressourcen
 * (`speakcore.managed` ≠ `true`) werden **verworfen**; es werden ausschließlich SpeakCore-Labels
 * übernommen (keine fremden Labels/Details). Keine Netzwerk-/Docker-I/O hier.
 */
import { LABEL_INSTANCE, LABEL_MANAGED, LABEL_PROJECT, LABEL_SERVICE } from '@speakcore/shared';
import type {
  DockerManagedContainer,
  DockerManagedNetwork,
  DockerManagedVolume,
  ManagedResourceLabelSet,
} from '@speakcore/types';

/** Feld-Trennzeichen der `--format`-Ausgabe. */
export const FIELD_SEP = '|';

/** Zerlegt eine Zeile in genau `count` Felder (das letzte Feld behält übrige Trennzeichen). */
export function splitFields(line: string, count: number): string[] {
  const parts: string[] = [];
  let rest = line;
  for (let i = 0; i < count - 1; i++) {
    const idx = rest.indexOf(FIELD_SEP);
    if (idx === -1) {
      parts.push(rest);
      rest = '';
    } else {
      parts.push(rest.slice(0, idx));
      rest = rest.slice(idx + 1);
    }
  }
  parts.push(rest);
  return parts;
}

/** Parst Dockers `{{.Labels}}`-Feld (`k=v,k2=v2`). */
export function parseLabels(labelsField: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of labelsField.split(',')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    result[pair.slice(0, eq).trim()] = pair.slice(eq + 1);
  }
  return result;
}

/**
 * Managed-Only-Guard: liefert die gefilterten SpeakCore-Labels **nur**, wenn die Ressource
 * eindeutig verwaltet ist (`speakcore.managed=true`). Sonst `null` (Ressource wird verworfen).
 */
export function toManagedLabelSet(labels: Record<string, string>): ManagedResourceLabelSet | null {
  if (labels[LABEL_MANAGED] !== 'true') return null;
  const set: ManagedResourceLabelSet = { managed: 'true' };
  if (labels[LABEL_PROJECT]) set.project = labels[LABEL_PROJECT];
  if (labels[LABEL_INSTANCE]) set.instanceId = labels[LABEL_INSTANCE];
  if (labels[LABEL_SERVICE]) set.service = labels[LABEL_SERVICE];
  return set;
}

function lines(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.replace(/\r$/, '').trim())
    .filter((l) => l.length > 0);
}

/** Format: `id|name|state|labels`. */
export function parseContainers(output: string): DockerManagedContainer[] {
  const result: DockerManagedContainer[] = [];
  for (const line of lines(output)) {
    const [id, name, state, labelsField] = splitFields(line, 4);
    const labels = toManagedLabelSet(parseLabels(labelsField ?? ''));
    if (!labels || !id) continue;
    result.push({
      id,
      name: name ?? '',
      kind: 'container',
      managed: true,
      ...(labels.instanceId ? { instanceId: labels.instanceId } : {}),
      ...(labels.service ? { service: labels.service } : {}),
      ...(state ? { state } : {}),
      labels,
    });
  }
  return result;
}

/** Format: `name|labels`. */
export function parseVolumes(output: string): DockerManagedVolume[] {
  const result: DockerManagedVolume[] = [];
  for (const line of lines(output)) {
    const [name, labelsField] = splitFields(line, 2);
    const labels = toManagedLabelSet(parseLabels(labelsField ?? ''));
    if (!labels || !name) continue;
    result.push({
      name,
      kind: 'volume',
      managed: true,
      ...(labels.instanceId ? { instanceId: labels.instanceId } : {}),
      ...(labels.service ? { service: labels.service } : {}),
      labels,
    });
  }
  return result;
}

/** Format: `id|name|labels`. */
export function parseNetworks(output: string): DockerManagedNetwork[] {
  const result: DockerManagedNetwork[] = [];
  for (const line of lines(output)) {
    const [id, name, labelsField] = splitFields(line, 3);
    const labels = toManagedLabelSet(parseLabels(labelsField ?? ''));
    if (!labels || !id) continue;
    result.push({
      id,
      name: name ?? '',
      kind: 'network',
      managed: true,
      ...(labels.instanceId ? { instanceId: labels.instanceId } : {}),
      ...(labels.service ? { service: labels.service } : {}),
      labels,
    });
  }
  return result;
}
