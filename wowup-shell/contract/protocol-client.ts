import { app } from "electron";

/** Same value as APP_PROTOCOL_NAME in wowup-electron/src/common/constants; the shell can't import app code */
export const WOWUP_PROTOCOL_NAME = "wowup";

/**
 * Registered handlers launch the bare executable with only the link as an argument. Running unpackaged
 * (`electron ../wowup-shell --serve`) that executable is electron itself, which then takes the link for the
 * app path and fails with "Unable to find Electron app". Register the app path as well, plus --serve and
 * the --bundle-dir the dev scripts pass (the bootstrap has already made it absolute).
 */
function getLaunchArgs(): { exePath: string; args: string[] } | undefined {
  if (!process.defaultApp) {
    return undefined;
  }

  // Not argv[1], ow-electron puts its own switches (--force-cmp) ahead of the app path
  const args = [app.getAppPath()];
  for (const arg of process.argv) {
    if (arg === "--serve" || arg.startsWith("--bundle-dir=")) {
      args.push(arg);
    }
  }

  return { exePath: process.execPath, args };
}

export function setAsDefaultProtocolClient(protocol: string): boolean {
  const launch = getLaunchArgs();
  return launch
    ? app.setAsDefaultProtocolClient(protocol, launch.exePath, launch.args)
    : app.setAsDefaultProtocolClient(protocol);
}

export function isDefaultProtocolClient(protocol: string): boolean {
  const launch = getLaunchArgs();
  return launch
    ? app.isDefaultProtocolClient(protocol, launch.exePath, launch.args)
    : app.isDefaultProtocolClient(protocol);
}

export function removeAsDefaultProtocolClient(protocol: string): boolean {
  const launch = getLaunchArgs();
  return launch
    ? app.removeAsDefaultProtocolClient(protocol, launch.exePath, launch.args)
    : app.removeAsDefaultProtocolClient(protocol);
}
