// The throwaway key that local builds and local publishes sign bundle manifests with, made on first use. A shell
// trusts it only when packaged from a locally signed bundle (wowup-shell/scripts/build-shell.js); release
// builds, signed with the real key in CI, never do. See SHELL_BUNDLE_PLAN.md.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const LOCAL_KEY_ID = "local-test";

// Under app-build/, so it's never committed; wowup-shell/scripts/build-shell.js reads it from this path too
export const LOCAL_KEY_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "app-build",
  "local-publish",
  "local-test-key.pem",
);

export function getLocalKey(): string {
  if (!existsSync(LOCAL_KEY_FILE)) {
    mkdirSync(dirname(LOCAL_KEY_FILE), { recursive: true });
    const { privateKey } = generateKeyPairSync("ed25519");
    writeFileSync(LOCAL_KEY_FILE, privateKey.export({ type: "pkcs8", format: "pem" }));
  }
  return readFileSync(LOCAL_KEY_FILE, "utf8");
}
