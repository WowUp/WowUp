import { join } from "path";

import { getShell } from "./shell/shell-api";

// Where the bundle's files live. App code resolves files through here instead of app.getAppPath() or
// __dirname (enforced in .eslintrc.js), so the bundle can be loaded from somewhere other than the install
// directory. See SHELL_BUNDLE_PLAN.md.

/** Directory holding the bundled main.js and preload.js */
export function getBundleDir(): string {
  return __dirname;
}

export function getPreloadPath(): string {
  return join(getBundleDir(), "preload.js");
}

export function getRendererIndexPath(): string {
  return join(getShell().paths.bundleRoot, "dist", "index.html");
}

export function getAssetPath(...segments: string[]): string {
  return join(getShell().paths.bundleRoot, "assets", ...segments);
}

/** The native addon ships with the shell, since it's compiled against the shell's Electron */
export function getNativeAddonPath(): string {
  return getShell().paths.nativeAddon;
}

/** Install directory of the shell, for things that ship with the binary rather than the bundle */
export function getShellRoot(): string {
  return getShell().paths.shellRoot;
}
