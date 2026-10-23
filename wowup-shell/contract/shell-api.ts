/**
 * Contract between the signed shell (wowup-shell/src/bootstrap.ts) and the app bundle it loads.
 * Bump SHELL_API_VERSION whenever the bundle starts relying on something new from the shell.
 * See wowup-electron/SHELL_BUNDLE_PLAN.md.
 */
export const SHELL_API_VERSION = 1;

export interface ShellPaths {
  /** Install directory of the signed shell, for things that ship with the binary */
  shellRoot: string;
  /** Directory the app bundle was loaded from */
  bundleRoot: string;
  /** The native addon, which is compiled against the shell's Electron and ships with it */
  nativeAddon: string;
}

/** The bundle the shell loaded. Its version is the app's version; app.getVersion() is the installed shell's. */
export interface LoadedBundleInfo {
  version: string;
  /** The channel it was published to (beta, stable), or "dev" for an unpackaged run */
  channel: string;
  /** Downloaded into userData, built into the installer, or an unpackaged dev build */
  source: "downloaded" | "builtin" | "dev";
}

export interface WowUpShell {
  apiVersion: number;
  /** Directory the shell pointed electron-log at */
  logPath: string;
  paths: ShellPaths;
  bundle: LoadedBundleInfo;
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
    throw new Error("WowUp shell not initialized, the app must be started through the wowup-shell bootstrap");
  }
  return shell;
}
