import * as crypto from "crypto";
import * as path from "path";

import { app } from "electron";

import { FileHashAlgorithms } from "./folder-scan-context";

interface NativeHashAddon {
  computeHash: (buffer: Buffer, length: number) => number;
}

let nativeAddon: NativeHashAddon | undefined;

/**
 * Loaded on first use rather than at import: only the curseforge fingerprint needs it, so the wago
 * flavor never pulls the native module in at all.
 */
function getNativeAddon(): NativeHashAddon {
  /* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment */
  nativeAddon ??= require(path.join(app.getAppPath(), "build/Release/addon.node")) as NativeHashAddon;
  /* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment */
  return nativeAddon;
}

export const nodeHashAlgorithms: FileHashAlgorithms = {
  md5: (buffer: Buffer): string => crypto.createHash("md5").update(buffer).digest("hex"),
  murmur: (buffer: Buffer): number => getNativeAddon().computeHash(buffer, buffer.length),
};
