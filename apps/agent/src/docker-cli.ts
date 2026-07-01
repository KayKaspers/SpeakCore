import { execFile } from 'node:child_process';

/**
 * Kontrollierte Docker-CLI-Ausführung (NDF Step 012).
 * `execFile` ohne Shell, **statische Argumente** (vom Aufrufer intern erzeugt, nie frei vom Nutzer),
 * Timeout. Kein Socket. Liefert Erfolg + stdout; wirft nicht.
 */
export interface DockerExecResult {
  ok: boolean;
  stdout: string;
}

export type DockerExec = (args: string[]) => Promise<DockerExecResult>;

const CLI_TIMEOUT_MS = 5000;

export const dockerExec: DockerExec = (args) =>
  new Promise((resolve) => {
    execFile(
      'docker',
      args,
      { timeout: CLI_TIMEOUT_MS, windowsHide: true, shell: false },
      (error, stdout) => {
        resolve({ ok: !error, stdout: stdout?.toString() ?? '' });
      },
    );
  });
