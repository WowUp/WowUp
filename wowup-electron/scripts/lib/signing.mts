// Signs bundle manifests, see SHELL_BUNDLE_PLAN.md. CI uses the key in the BUNDLE_SIGNING_KEY (PKCS#8 PEM) and
// BUNDLE_SIGNING_KEY_ID environment variables; scripts/publish-local.mts passes a throwaway local key.
import { createPrivateKey, createPublicKey } from "node:crypto";

import {
  type BundleManifest,
  signManifest,
  type UnsignedBundleManifest,
  verifyManifest,
} from "../../../wowup-shell/contract/bundle-manifest.ts";

export function hasSigningKey(): boolean {
  return Boolean(process.env.BUNDLE_SIGNING_KEY && process.env.BUNDLE_SIGNING_KEY_ID);
}

export function getPublicKeyPem(privateKeyPem: string): string {
  return createPublicKey(createPrivateKey(privateKeyPem)).export({ type: "spki", format: "pem" }).toString();
}

/** Signs with the given key, checking the result against the matching public key */
export function signWithKey(manifest: UnsignedBundleManifest, keyId: string, privateKeyPem: string): BundleManifest {
  // Re-signing an already signed manifest replaces its signature
  const { keyId: _oldKeyId, signature: _oldSignature, ...unsigned } = manifest as Partial<BundleManifest>;
  const signed = signManifest(unsigned as UnsignedBundleManifest, keyId, privateKeyPem);

  if (!verifyManifest(signed, { [keyId]: getPublicKeyPem(privateKeyPem) })) {
    throw new Error("The signed manifest failed verification");
  }

  return signed;
}

/** Signs with the environment's key */
export function signWithEnvKey(manifest: UnsignedBundleManifest): BundleManifest {
  const privateKeyPem = process.env.BUNDLE_SIGNING_KEY;
  const keyId = process.env.BUNDLE_SIGNING_KEY_ID;
  if (!privateKeyPem || !keyId) {
    throw new Error("BUNDLE_SIGNING_KEY and BUNDLE_SIGNING_KEY_ID must be set");
  }

  return signWithKey(manifest, keyId, privateKeyPem);
}
