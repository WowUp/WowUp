import { join } from "path";

import { getShell } from "./shell/shell-api";

// Where the bundle's files live. App code resolves files through here instead of app.getAppPath() or
// __dirname (enforced in .eslintrc.js), so the bundle can be loaded from somewhere other than the install
// directory. The bundle is one self-contained folder (or bundle.asar): main.js, preload.js, renderer/ and
// assets/. See SHELL_BUNDLE_PLAN.md.

/** Root of the loaded bundle, holding main.js and preload.js */
export function getBundleDir(): string {
  return getShell().paths.bundleRoot;
}

export function getPreloadPath(): string {
  return join(getBundleDir(), "preload.js");
}

export function getRendererIndexPath(): string {
  return join(getBundleDir(), "renderer", "index.html");
}

export function getAssetPath(...segments: string[]): string {
  return join(getBundleDir(), "assets", ...segments);
}

/** The native addon ships with the shell, since it's compiled against the shell's Electron */
export function getNativeAddonPath(): string {
  return getShell().paths.nativeAddon;
}

/** Install directory of the shell, for things that ship with the binary rather than the bundle */
export function getShellRoot(): string {
  return getShell().paths.shellRoot;
}
