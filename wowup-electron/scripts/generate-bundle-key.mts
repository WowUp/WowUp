// Generates the ed25519 key pair that bundle manifests are signed with, see SHELL_BUNDLE_PLAN.md.
// Run it yourself and keep the private key out of the repository: store it as the BUNDLE_SIGNING_KEY CI
// secret (and the key id as BUNDLE_SIGNING_KEY_ID), then delete the file.
//
//   node scripts/generate-bundle-key.mts <key-id> <private-key-file>
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const [keyId, privateKeyFile] = process.argv.slice(2);
if (!keyId || !privateKeyFile) {
  console.error("Usage: node scripts/generate-bundle-key.mts <key-id> <private-key-file>");
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

try {
  // "wx" refuses to overwrite an existing key
  writeFileSync(privateKeyFile, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600, flag: "wx" });
} catch (e) {
  console.error(`Could not write ${privateKeyFile}: ${(e as Error).message}`);
  process.exit(1);
}

const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

console.log(`Private key written to ${privateKeyFile}.`);
console.log(`Store it as the BUNDLE_SIGNING_KEY secret and "${keyId}" as BUNDLE_SIGNING_KEY_ID, then delete the file.`);
console.log("");
console.log("Add this entry to BUNDLE_PUBLIC_KEYS in app/shell/bundle-keys.ts:");
console.log("");
console.log(`  ${JSON.stringify(keyId)}: ${JSON.stringify(publicKeyPem)},`);
