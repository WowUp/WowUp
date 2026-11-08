import * as crypto from "crypto";

import { getNativeAddonPath } from "../../bundle-paths";
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
  nativeAddon ??= require(getNativeAddonPath()) as NativeHashAddon;

  return nativeAddon;
}

export const nodeHashAlgorithms: FileHashAlgorithms = {
  md5: (buffer: Buffer): string => crypto.createHash("md5").update(buffer).digest("hex"),
  murmur: (buffer: Buffer): number => getNativeAddon().computeHash(buffer, buffer.length),
};
