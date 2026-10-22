// Signs bundle manifests with the key in the BUNDLE_SIGNING_KEY (PKCS#8 PEM) and BUNDLE_SIGNING_KEY_ID
// environment variables, see SHELL_BUNDLE_PLAN.md.
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

/** Signs with the environment's key, checking the result against the matching public key */
export function signWithEnvKey(manifest: UnsignedBundleManifest): BundleManifest {
  const privateKeyPem = process.env.BUNDLE_SIGNING_KEY;
  const keyId = process.env.BUNDLE_SIGNING_KEY_ID;
  if (!privateKeyPem || !keyId) {
    throw new Error("BUNDLE_SIGNING_KEY and BUNDLE_SIGNING_KEY_ID must be set");
  }

  // Re-signing an already signed manifest replaces its signature
  const { keyId: _oldKeyId, signature: _oldSignature, ...unsigned } = manifest as Partial<BundleManifest>;
  const signed = signManifest(unsigned as UnsignedBundleManifest, keyId, privateKeyPem);

  const publicKeyPem = createPublicKey(createPrivateKey(privateKeyPem))
    .export({ type: "spki", format: "pem" })
    .toString();
  if (!verifyManifest(signed, { [keyId]: publicKeyPem })) {
    throw new Error("The signed manifest failed verification");
  }

  return signed;
}
