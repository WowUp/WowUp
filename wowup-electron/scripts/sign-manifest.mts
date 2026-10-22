// Signs a bundle manifest written by scripts/build-bundle.mts, see SHELL_BUNDLE_PLAN.md. The private key
// and its id come from the BUNDLE_SIGNING_KEY (PKCS#8 PEM) and BUNDLE_SIGNING_KEY_ID environment variables.
//
//   node scripts/sign-manifest.mts <manifest-file> [signed-manifest-file]
import { readFileSync, writeFileSync } from "node:fs";

import { signWithEnvKey } from "./lib/signing.mts";

const [manifestFile, outFile = manifestFile] = process.argv.slice(2);
if (!manifestFile) {
  console.error("Usage: node scripts/sign-manifest.mts <manifest-file> [signed-manifest-file]");
  process.exit(1);
}

try {
  const signed = signWithEnvKey(JSON.parse(readFileSync(manifestFile, "utf8")));
  writeFileSync(outFile, JSON.stringify(signed, null, 2));
  console.log(`Signed ${outFile} with key ${signed.keyId}`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
