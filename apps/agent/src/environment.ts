import os from 'node:os';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { EnvironmentDetection, EnvironmentKind } from '@speakcore/types';

/**
 * Read-only Umgebungserkennung (NDF Step 007).
 *
 * STRIKT lesend: nur `systemd-detect-virt` (statische Argumente, execFile ohne Shell, Timeout)
 * und – als Fallback – das Lesen von `/proc/1/cgroup`. KEINE externen Requests, KEINE Steuerung.
 * Nicht zuverlässig erkennbar ⇒ `unknown` (lieber unsicher als falsche Sicherheit).
 */
const CLI_TIMEOUT_MS = 1500;

const CONTAINER_HINTS = [
  'lxc',
  'lxc-libvirt',
  'openvz',
  'docker',
  'podman',
  'rkt',
  'systemd-nspawn',
  'wsl',
];

/** Reine Klassifikation der `systemd-detect-virt`-Ausgabe. */
export function classifyVirtualization(virt: string): EnvironmentKind {
  const v = virt.trim().toLowerCase();
  if (!v) return 'unknown';
  if (v === 'none') return 'bare-metal';
  if (CONTAINER_HINTS.includes(v)) return 'container';
  // Übrige Werte von systemd-detect-virt sind VM-Typen (kvm, qemu, vmware, xen, microsoft, …).
  return 'vm';
}

/** Reine Klassifikation von `/proc/1/cgroup`-Inhalt (Fallback-Heuristik). */
export function classifyCgroup(content: string): EnvironmentKind | null {
  const c = content.toLowerCase();
  if (c.includes('lxc')) return 'container';
  if (c.includes('docker')) return 'container';
  return null;
}

function runDetectVirt(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'systemd-detect-virt',
      [],
      { timeout: CLI_TIMEOUT_MS, windowsHide: true, shell: false },
      (_error, stdout) => {
        // systemd-detect-virt liefert Exitcode 1 bei "none" – stdout enthält dennoch den Wert.
        const out = stdout?.toString().trim();
        resolve(out ? out : null);
      },
    );
  });
}

export async function detectEnvironment(): Promise<EnvironmentDetection> {
  if (os.platform() !== 'linux') {
    // Auf Nicht-Linux nicht raten.
    return { kind: 'unknown', confident: false };
  }

  const virt = await runDetectVirt();
  if (virt) {
    return { kind: classifyVirtualization(virt), virtualization: virt, confident: true };
  }

  try {
    const content = await readFile('/proc/1/cgroup', 'utf8');
    const fromCgroup = classifyCgroup(content);
    if (fromCgroup) return { kind: fromCgroup, confident: false };
  } catch {
    // ignorieren – Datei evtl. nicht vorhanden/lesbar
  }

  return { kind: 'unknown', confident: false };
}
