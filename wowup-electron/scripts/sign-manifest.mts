// Signs a bundle manifest written by scripts/build-bundle.mts, see SHELL_BUNDLE_PLAN.md. The private key
// and its id come from the BUNDLE_SIGNING_KEY (PKCS#8 PEM) and BUNDLE_SIGNING_KEY_ID environment variables.
//
//   node scripts/sign-manifest.mts <manifest-file> [signed-manifest-file]
import { createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { signManifest, type UnsignedBundleManifest, verifyManifest } from "../app/shell/bundle-manifest.ts";

const [manifestFile, outFile = manifestFile] = process.argv.slice(2);
const privateKeyPem = process.env.BUNDLE_SIGNING_KEY;
const keyId = process.env.BUNDLE_SIGNING_KEY_ID;

if (!manifestFile) {
  console.error("Usage: node scripts/sign-manifest.mts <manifest-file> [signed-manifest-file]");
  process.exit(1);
}
if (!privateKeyPem || !keyId) {
  console.error("BUNDLE_SIGNING_KEY and BUNDLE_SIGNING_KEY_ID must be set");
  process.exit(1);
}

// Re-signing an already signed manifest replaces its signature
const { keyId: _oldKeyId, signature: _oldSignature, ...unsigned } = JSON.parse(readFileSync(manifestFile, "utf8"));
const signed = signManifest(unsigned as UnsignedBundleManifest, keyId, privateKeyPem);

// Check the result against the matching public key before anything gets published with it
const publicKeyPem = createPublicKey(createPrivateKey(privateKeyPem))
  .export({ type: "spki", format: "pem" })
  .toString();
if (!verifyManifest(signed, { [keyId]: publicKeyPem })) {
  console.error("The signed manifest failed verification");
  process.exit(1);
}

writeFileSync(outFile, JSON.stringify(signed, null, 2));
console.log(`Signed ${outFile} with key ${keyId}`);
