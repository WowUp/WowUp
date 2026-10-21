/**
 * Contract between the signed shell (app/shell/bootstrap.ts) and the app bundle it loads.
 * Bump SHELL_API_VERSION whenever the bundle starts relying on something new from the shell.
 * See SHELL_BUNDLE_PLAN.md.
 */
export const SHELL_API_VERSION = 1;

export interface WowUpShell {
  apiVersion: number;
  /** Directory the shell pointed electron-log at */
  logPath: string;
  /** Tells the shell this bundle started successfully, so it won't be rolled back */
  markHealthy(): void;
}

const SHELL_GLOBAL_KEY = "__wowupShell";

// Handed over on globalThis rather than module state: once the bundle is built on its own it gets its own
// copy of this module, and module state set by the shell would not be visible to it.
function shellGlobal(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

export function setShell(shell: WowUpShell): void {
  shellGlobal()[SHELL_GLOBAL_KEY] = shell;
}

export function getShell(): WowUpShell {
  const shell = shellGlobal()[SHELL_GLOBAL_KEY] as WowUpShell | undefined;
  if (shell === undefined) {
    throw new Error("WowUp shell not initialized, the app must be started through app/shell/bootstrap");
  }
  return shell;
}
